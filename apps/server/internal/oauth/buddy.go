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
		ExpiresIn:    buddyAccessTokenTTL,
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
	// A rejected refresh is reported exactly like a standard OAuth rejection so
	// the manager's permanent/transient decision still applies.
	if status >= 400 {
		return nil, classifyRefreshError(raw, status)
	}
	var envelope buddyEnvelope
	if err := json.Unmarshal(raw, &envelope); err != nil {
		return nil, fmt.Errorf("oauth: parse buddy refresh response: %w", err)
	}
	var data struct {
		AccessToken  string `json:"accessToken"`
		RefreshToken string `json:"refreshToken"`
		ExpiresIn    int    `json:"expiresIn"`
	}
	if err := json.Unmarshal(envelope.Data, &data); err != nil {
		return nil, fmt.Errorf("oauth: parse buddy refresh data: %w", err)
	}
	if envelope.Code != 0 || data.AccessToken == "" {
		return nil, fmt.Errorf("oauth: buddy refresh failed: %s", nonEmpty(envelope.Msg, "no access token in the reply"))
	}
	next := data.RefreshToken
	if next == "" {
		next = refreshToken
	}
	expiresIn := data.ExpiresIn
	if expiresIn <= 0 {
		expiresIn = buddyAccessTokenTTL
	}
	return &Tokens{AccessToken: data.AccessToken, RefreshToken: next, ExpiresIn: expiresIn}, nil
}
