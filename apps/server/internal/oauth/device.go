package oauth

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// deviceFlowExpiry bounds an in-flight device sign-in when the provider does
// not advertise one, and devicePollInterval is the fallback poll cadence —
// both mirror the ZCode device flow's own defaults.
const (
	deviceFlowExpiry     = 5 * time.Minute
	devicePollInterval   = 2 * time.Second
	devicePollMaxAwait   = 8 * time.Second
	deviceRequestTimeout = 20 * time.Second
)

// DeviceFlow is one in-progress device sign-in: the server polls it until it
// reports ready (the user approved in the browser), failed, or expired.
type DeviceFlow struct {
	FlowID       string
	AuthorizeURL string
	// PollToken authenticates every poll request for this flow. The server
	// generates it at init time; the provider may hand back its own.
	PollToken string
	Interval  time.Duration
	ExpiresAt time.Time
}

// deviceInitResponse is the parsed body of the flow-start endpoint.
type deviceInitResponse struct {
	Data struct {
		FlowID       string `json:"flow_id"`
		AuthorizeURL string `json:"authorize_url"`
		ExpiresAt    any    `json:"expires_at"`
		PollInterval int    `json:"poll_interval_sec"`
		PollToken    string `json:"poll_token"`
	} `json:"data"`
	Code any    `json:"code"`
	Msg  string `json:"msg"`
}

// DeviceInit starts a device sign-in: it registers a flow and returns the
// authorize URL the dashboard must open for the user. The poll token is
// generated here and stays server-side; the browser never sees it.
func (c ProviderConfig) DeviceInit(ctx context.Context) (*DeviceFlow, error) {
	raw := make([]byte, 32)
	if _, err := rand.Read(raw); err != nil {
		return nil, fmt.Errorf("oauth: generate poll token: %w", err)
	}
	pollToken := hex.EncodeToString(raw)

	provider := c.TokenBodyProvider
	if provider == "" {
		provider = "zai"
	}
	body, _ := json.Marshal(map[string]string{"provider": provider})

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.DeviceInitURL, strings.NewReader(string(body)))
	if err != nil {
		return nil, fmt.Errorf("oauth: build device init: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+pollToken)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	rawBody, err := doJSONRequest(ctx, req)
	if err != nil {
		return nil, err
	}
	var parsed deviceInitResponse
	if err := json.Unmarshal(rawBody, &parsed); err != nil {
		return nil, fmt.Errorf("oauth: parse device init response: %w", err)
	}
	if parsed.Data.FlowID == "" || parsed.Data.AuthorizeURL == "" {
		return nil, fmt.Errorf("oauth: device init incomplete: %s", nonEmpty(parsed.Msg, truncate(rawBody, 300)))
	}

	flow := &DeviceFlow{
		FlowID:       parsed.Data.FlowID,
		AuthorizeURL: parsed.Data.AuthorizeURL,
		PollToken:    pollToken,
		Interval:     devicePollInterval,
		ExpiresAt:    time.Now().Add(deviceFlowExpiry),
	}
	if parsed.Data.PollToken != "" {
		flow.PollToken = parsed.Data.PollToken
	}
	if parsed.Data.PollInterval > 0 {
		flow.Interval = time.Duration(parsed.Data.PollInterval) * time.Second
	}
	// expires_at arrives as epoch seconds, epoch millis, or nothing.
	switch v := parsed.Data.ExpiresAt.(type) {
	case float64:
		t := time.Unix(int64(v), 0)
		if v > 1e12 {
			t = time.UnixMilli(int64(v))
		}
		if t.After(time.Now()) {
			flow.ExpiresAt = t
		}
	}
	return flow, nil
}

// devicePollResponse is the parsed body of one flow poll. Only "ready" carries
// the token grant (data.token); "failed" and "expired" are terminal, anything else (an
// empty status, or an upstream that answers 200 with code != 0) means the user
// has not approved yet.
type devicePollResponse struct {
	Data struct {
		Status string `json:"status"`
		// The token grant (object or bare string) is read by envelopeToken.
		User *struct {
			Email       string `json:"email"`
			Name        string `json:"name"`
			DisplayName string `json:"display_name"`
			Nickname    string `json:"nickname"`
		} `json:"user"`
	} `json:"data"`
	Code any    `json:"code"`
	Msg  string `json:"msg"`
}

// DevicePoll polls a device flow once. It returns one of the statuses
// "pending", "ready", "failed", "expired"; "ready" carries the tokens. The
// handler treats every other status as keep-waiting, so an unexpected body
// never aborts a healthy sign-in.
func (c ProviderConfig) DevicePoll(ctx context.Context, flowID, pollToken string) (string, *Tokens, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.DevicePollURL+"/"+flowID, nil)
	if err != nil {
		return "", nil, fmt.Errorf("oauth: build device poll: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+pollToken)
	req.Header.Set("Accept", "application/json")

	rawBody, status, err := doJSONRequestStatus(ctx, req)
	if err != nil {
		return "", nil, err
	}
	// The flow is gone server-side: a gone/not-found answer means the
	// five-minute sign-in window closed before the user approved.
	if status == http.StatusNotFound || status == http.StatusGone {
		return "expired", nil, nil
	}
	if status >= 400 {
		return "", nil, fmt.Errorf("oauth: device poll returned %d: %s", status, truncate(rawBody, 300))
	}

	var parsed devicePollResponse
	if err := json.Unmarshal(rawBody, &parsed); err != nil {
		return "", nil, fmt.Errorf("oauth: parse device poll response: %w", err)
	}
	switch strings.ToLower(strings.TrimSpace(parsed.Data.Status)) {
	case "ready":
		tokens, err := mapTokenResponse(envelopeToken(rawBody))
		if err != nil {
			return "failed", nil, nil
		}
		if u := parsed.Data.User; u != nil {
			tokens.Email = u.Email
			tokens.DisplayName = nonEmpty(u.DisplayName, u.Name, u.Nickname)
		}
		return "ready", tokens, nil
	case "failed":
		return "failed", nil, nil
	case "expired":
		return "expired", nil, nil
	default:
		return "pending", nil, nil
	}
}

// PollInterval returns how often the flow should be polled (bounded so a
// misconfigured provider cannot stall the dashboard's polling loop).
func (f *DeviceFlow) PollInterval() time.Duration {
	if f.Interval <= 0 || f.Interval > devicePollMaxAwait {
		return devicePollInterval
	}
	return f.Interval
}

// Expired reports whether the flow's sign-in window has closed.
func (f *DeviceFlow) Expired(now time.Time) bool {
	return now.After(f.ExpiresAt)
}

// doJSONRequest performs a request and returns the 2xx body, erroring on
// non-2xx like the token-request helper does.
func doJSONRequest(ctx context.Context, req *http.Request) ([]byte, error) {
	body, status, err := doJSONRequestStatus(ctx, req)
	if err != nil {
		return nil, err
	}
	if status >= 400 {
		return nil, fmt.Errorf("oauth: endpoint returned %d: %s", status, truncate(body, 300))
	}
	return body, nil
}

// doJSONRequestStatus performs a request with the shared OAuth client and
// returns the body plus status.
func doJSONRequestStatus(ctx context.Context, req *http.Request) ([]byte, int, error) {
	client := &http.Client{Timeout: deviceRequestTimeout}
	resp, err := client.Do(req)
	if err != nil {
		return nil, 0, fmt.Errorf("oauth: request: %w", err)
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(io.LimitReader(resp.Body, 64<<10))
	if err != nil {
		return nil, resp.StatusCode, fmt.Errorf("oauth: read response: %w", err)
	}
	return body, resp.StatusCode, nil
}

// nonEmpty returns the first non-blank string.
func nonEmpty(values ...string) string {
	for _, v := range values {
		if strings.TrimSpace(v) != "" {
			return v
		}
	}
	return ""
}
