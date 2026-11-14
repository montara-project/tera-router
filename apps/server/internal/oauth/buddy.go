package oauth

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// The Tencent buddy family — WorkBuddy, CodeBuddy, CodeBuddy CN — shares one
// plugin auth wire format: a browser sign-in polled by the server, then a
// refresh that carries the refresh token in a header instead of a form body.
// Only the host and the client identity differ between realms, so one flow
// implementation serves all three.

const (
	// workbuddyClientVersion is the WorkBuddy plugin release the realm
	// fingerprints. Its login page branches on the version hint, and the
	// gateway rejects a mismatched X-IDE-Version, so this must track the
	// shipped client.
	workbuddyClientVersion = "5.9.4"
	// codebuddyClientVersion is the CodeBuddy CLI release, shared by the
	// international and Tencent realms.
	codebuddyClientVersion = "2.180.0"

	buddyPollInterval = 5 * time.Second
	buddyFlowExpiry   = 5 * time.Minute
	// buddyAccessTokenTTL is the lifetime assumed for an issued access token:
	// the grant does not state one, and the token is a 24-hour session JWT.
	buddyAccessTokenTTL = 86400
)

// BuddyRealm identifies one realm of the buddy family: where it lives, the
// client identity it fingerprints, and the X-Domain value that identity sends.
type BuddyRealm struct {
	// Host is the realm's origin, without a trailing slash.
	Host string
	// Domain is the X-Domain header value, which must match Host.
	Domain string
	// Platform is the ?platform= value of the state request. WorkBuddy
	// identifies as "workbuddy-ai"; both CodeBuddy realms use "CLI".
	Platform string
	// ClientVersion is the client release the realm expects.
	ClientVersion string
	// IDE is the X-IDE-Type/Name pair: "WorkBuddy" or "CLI".
	IDE string
}

// isWorkBuddy reports whether the realm is WorkBuddy's, which identifies as its
// own desktop client rather than as the CodeBuddy CLI.
func (r BuddyRealm) isWorkBuddy() bool { return r.IDE == "WorkBuddy" }

// userAgent is the client string the realm's own app sends.
func (r BuddyRealm) userAgent() string {
	if r.isWorkBuddy() {
		return "CLI/" + r.ClientVersion
	}
	return "CLI/" + r.ClientVersion + " CodeBuddy/" + r.ClientVersion
}

// authHeaders are the headers every buddy auth request carries. The X-No-*
// flags tell the gateway the request is pre-authentication.
func (r BuddyRealm) authHeaders() map[string]string {
	h := map[string]string{
		"Content-Type":         "application/json",
		"Accept":               "application/json",
		"User-Agent":           r.userAgent(),
		"X-Requested-With":     "XMLHttpRequest",
		"X-Domain":             r.Domain,
		"X-No-Authorization":   "true",
		"X-No-User-Id":         "true",
		"X-No-Enterprise-Id":   "true",
		"X-No-Department-Info": "true",
		"X-Product":            "SaaS",
		"X-IDE-Type":           r.IDE,
		"X-IDE-Name":           r.IDE,
		"X-IDE-Version":        r.ClientVersion,
	}
	if r.isWorkBuddy() {
		h["X-Private-Data"] = "true"
	} else {
		h["X-Product-Version"] = r.ClientVersion
	}
	return h
}

// buddyEnvelope is the reply shape shared by the buddy auth endpoints.
type buddyEnvelope struct {
	Code int             `json:"code"`
	Msg  string          `json:"msg"`
	Data json.RawMessage `json:"data"`
}

// buddyInit requests a login state and the browser URL the user must approve.
// The state doubles as the poll key, so it becomes the flow id.
func buddyInit(ctx context.Context, realm BuddyRealm) (*DeviceFlow, error) {
	endpoint := realm.Host + "/v2/plugin/auth/state?platform=" + url.QueryEscape(realm.Platform)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, strings.NewReader("{}"))
	if err != nil {
		return nil, fmt.Errorf("oauth: build buddy state request: %w", err)
	}
	for k, v := range realm.authHeaders() {
		req.Header.Set(k, v)
	}
	raw, status, err := doJSONRequestStatus(ctx, req)
	if err != nil {
		return nil, err
	}
	if status >= 400 {
		return nil, fmt.Errorf("oauth: buddy state request returned %d: %s", status, truncate(raw, 300))
	}
	var envelope buddyEnvelope
	if err := json.Unmarshal(raw, &envelope); err != nil {
		return nil, fmt.Errorf("oauth: parse buddy state response: %w", err)
	}
	var data struct {
		State   string `json:"state"`
		AuthURL string `json:"authUrl"`
	}
	if err := json.Unmarshal(envelope.Data, &data); err != nil {
		return nil, fmt.Errorf("oauth: parse buddy state data: %w", err)
	}
	if envelope.Code != 0 || data.State == "" || data.AuthURL == "" {
		return nil, fmt.Errorf("oauth: buddy state error: %s", nonEmpty(envelope.Msg, "missing state/authUrl"))
	}
	authURL, err := buddyAuthURL(data.AuthURL, realm.ClientVersion)
	if err != nil {
		return nil, err
	}
	return &DeviceFlow{
		FlowID:       data.State,
		AuthorizeURL: authURL,
		// The realm's poll endpoint keys on the state alone; the poll token is
		// this server's own and is never sent upstream.
		PollToken: data.State,
		Interval:  buddyPollInterval,
		ExpiresAt: time.Now().Add(buddyFlowExpiry),
	}, nil
}

// buddyAuthURL attaches the version hint the plugin login page branches on.
func buddyAuthURL(raw, version string) (string, error) {
	if version == "" {
		return raw, nil
	}
	parsed, err := url.Parse(raw)
	if err != nil {
		return "", fmt.Errorf("oauth: parse buddy auth url: %w", err)
	}
	q := parsed.Query()
	q.Set("version", version)
	parsed.RawQuery = q.Encode()
	return parsed.String(), nil
}

// buddyPoll asks the realm whether the user approved the sign-in. Code 11217
// means "not yet"; code 0 with an access token is the grant.
func buddyPoll(ctx context.Context, realm BuddyRealm, state string) (string, *Tokens, error) {
	endpoint := realm.Host + "/v2/plugin/auth/token?state=" + url.QueryEscape(state)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return "", nil, fmt.Errorf("oauth: build buddy poll request: %w", err)
	}
	for k, v := range realm.authHeaders() {
		req.Header.Set(k, v)
	}
	delete(req.Header, "Content-Type")
	raw, status, err := doJSONRequestStatus(ctx, req)
	if err != nil {
		// A transport blip must not end a healthy sign-in: keep polling until
		// the flow's own expiry closes the window.
		if ctx.Err() != nil {
			return "", nil, err
		}
		return "pending", nil, nil
	}
	if status >= 500 {
		return "pending", nil, nil
	}
	if status >= 400 {
		return "", nil, fmt.Errorf("oauth: buddy poll returned %d: %s", status, truncate(raw, 300))
	}
	var envelope buddyEnvelope
	if err := json.Unmarshal(raw, &envelope); err != nil {
		return "", nil, fmt.Errorf("oauth: parse buddy poll response: %w", err)
	}
	switch envelope.Code {
	case 0:
	case 11217:
		return "pending", nil, nil
	default:
		return "", nil, fmt.Errorf("oauth: buddy sign-in: %s", nonEmpty(envelope.Msg, fmt.Sprintf("code %d", envelope.Code)))
	}
	var data struct {
		AccessToken  string `json:"accessToken"`
		RefreshToken string `json:"refreshToken"`
	}
	if err := json.Unmarshal(envelope.Data, &data); err != nil {
		return "", nil, fmt.Errorf("oauth: parse buddy token data: %w", err)
	}
	if data.AccessToken == "" {
		return "failed", nil, nil
	}
	tokens := &Tokens{
		AccessToken:  data.AccessToken,
		RefreshToken: data.RefreshToken,
		ExpiresIn:    buddyLifetime(data.AccessToken, 0),
	}
	// The access token is the session JWT and carries the account email, which
	// the poll reply omits. Decoding it gives the account a real label and lets
	// a reconnect dedup on identity.
	if payload := decodeJWTPayload(data.AccessToken); payload != nil {
		if email, _ := payload["email"].(string); email != "" {
			tokens.Email = email
		}
		if name, _ := payload["name"].(string); name != "" {
			tokens.DisplayName = name
		}
	}
	return "ready", tokens, nil
}

// buddyRefresh renews an access token. Every realm takes POST with an empty
// JSON body and the refresh token in X-Refresh-Token; the reply wraps the new
// pair in {code, msg, data}.
func buddyRefresh(ctx context.Context, realm BuddyRealm, refreshToken string) (*Tokens, error) {
	if refreshToken == "" {
		return nil, fmt.Errorf("oauth: no refresh token available")
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, realm.Host+"/v2/plugin/auth/token/refresh", strings.NewReader("{}"))
	if err != nil {
		return nil, fmt.Errorf("oauth: build buddy refresh request: %w", err)
	}
	for k, v := range realm.authHeaders() {
		req.Header.Set(k, v)
	}
	req.Header.Set("X-Refresh-Token", refreshToken)
	req.Header.Set("X-Auth-Refresh-Source", "plugin")

	raw, status, err := doJSONRequestStatus(ctx, req)
	if err != nil {
		return nil, err
	}
	// A rejected refresh is reported as a RefreshError so the manager can tell
	// a dead token from a transient fault. The realm answers {code,msg}, which
	// classifyRefreshError cannot read, so the envelope is mapped here.
	if status >= 400 {
		return nil, buddyRefreshError(raw, status)
	}
	var envelope buddyEnvelope
	if err := json.Unmarshal(raw, &envelope); err != nil {
		return nil, fmt.Errorf("oauth: parse buddy refresh response: %w", err)
	}
	// A 2xx carrying an error code is the same rejection the HTTP status would
	// have reported, so it goes through the same mapping. It is checked before
	// data: a rejection usually carries none, and a parse error would read as
	// transient.
	if envelope.Code != 0 {
		return nil, buddyRefreshError(raw, http.StatusOK)
	}
	var data struct {
		AccessToken  string `json:"accessToken"`
		RefreshToken string `json:"refreshToken"`
		ExpiresIn    int    `json:"expiresIn"`
	}
	if err := json.Unmarshal(envelope.Data, &data); err != nil {
		return nil, fmt.Errorf("oauth: parse buddy refresh data: %w", err)
	}
	if data.AccessToken == "" {
		return nil, buddyRefreshError(raw, http.StatusOK)
	}
	next := data.RefreshToken
	if next == "" {
		next = refreshToken
	}
	return &Tokens{AccessToken: data.AccessToken, RefreshToken: next, ExpiresIn: buddyLifetime(data.AccessToken, data.ExpiresIn)}, nil
}

// buddyRefreshError maps a rejected buddy refresh onto the manager's
// permanent/transient model. The realm reports failures as {code,msg} rather
// than the OAuth {error,error_description} shape, so the standard classifier
// would read an empty code and call every rejection transient — leaving a dead
// refresh token in place forever.
//
// A rejection is permanent when the realm says the token itself is unusable:
// an auth status with no rate-limit marker, or a message naming the refresh
// token. Rate limits and 5xx stay transient so the next request retries.
func buddyRefreshError(body []byte, status int) *RefreshError {
	var envelope buddyEnvelope
	_ = json.Unmarshal(body, &envelope)
	msg := strings.TrimSpace(envelope.Msg)

	permanent := false
	switch {
	case status == http.StatusTooManyRequests || status >= 500:
		permanent = false
	case status == http.StatusUnauthorized || status == http.StatusForbidden:
		permanent = true
	case envelope.Code != 0 && envelope.Code != 11217:
		// Any other envelope error is the realm refusing the grant.
		permanent = true
	}
	// A rate-limit message overrides an auth status: it is a throttle, not a
	// dead token.
	if low := strings.ToLower(msg); strings.Contains(low, "rate limit") || strings.Contains(low, "too many") {
		permanent = false
	}

	code := "buddy_refresh_rejected"
	if envelope.Code != 0 {
		code = fmt.Sprintf("buddy_code_%d", envelope.Code)
	}
	return &RefreshError{Code: code, Message: msg, HTTPStatus: status, Permanent: permanent}
}

// buddyLifetime returns the access token's lifetime in seconds: the `exp`
// claim when the token is a JWT, otherwise the advertised value, otherwise the
// assumed default. Assuming a fixed lifetime is not safe — an over-estimate
// makes every call send an expired token, and EnsureFresh never refreshes it.
func buddyLifetime(token string, advertised int) int {
	if payload := decodeJWTPayload(token); payload != nil {
		if exp, ok := payload["exp"].(float64); ok && exp > 0 {
			// A known expiry wins even when it has passed: 0 means "unknown"
			// downstream and would leave an expired token looking fresh, so
			// a spent token reports the smallest lifetime and is refreshed.
			if until := int(time.Until(time.Unix(int64(exp), 0)).Seconds()); until > 1 {
				return until
			}
			return 1
		}
	}
	if advertised > 0 {
		return advertised
	}
	return buddyAccessTokenTTL
}
