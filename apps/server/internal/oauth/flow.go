package oauth

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"sort"
	"strings"
	"time"
)

// httpClient is shared across OAuth calls; per-request deadlines come from ctx.
var httpClient = &http.Client{
	Timeout:   30 * time.Second,
	Transport: http.DefaultTransport,
}

// AuthURL builds the provider authorize URL for the authorization-code + PKCE
// flow. challenge is the S256 code challenge.
func (c ProviderConfig) AuthURL(redirectURI, state, challenge string) string {
	params := c.authParams(redirectURI, state, challenge)
	if c.EncodeAuthSpacesAsPercent {
		return c.AuthorizeURL + "?" + encodeAuthParams(params, true)
	}

	q := url.Values{}
	for _, p := range params {
		q.Set(p.key, p.value)
	}
	return c.AuthorizeURL + "?" + q.Encode()
}

type authParam struct {
	key   string
	value string
}

func (c ProviderConfig) authParams(redirectURI, state, challenge string) []authParam {
	params := []authParam{
		{"response_type", "code"},
		{"client_id", c.ClientID},
		{"redirect_uri", redirectURI},
	}
	if len(c.Scopes) > 0 {
		params = append(params, authParam{"scope", strings.Join(c.Scopes, " ")})
	}
	if challenge != "" {
		params = append(params,
			authParam{"code_challenge", challenge},
			authParam{"code_challenge_method", "S256"},
		)
	}

	c.appendExtraAuthParams(&params)
	params = append(params, authParam{"state", state})
	return params
}

func (c ProviderConfig) appendExtraAuthParams(params *[]authParam) {
	seen := map[string]bool{}
	for _, key := range c.ExtraAuthParamOrder {
		if value, ok := c.ExtraAuthParams[key]; ok {
			*params = append(*params, authParam{key, value})
			seen[key] = true
		}
	}
	rest := make([]string, 0, len(c.ExtraAuthParams))
	for key := range c.ExtraAuthParams {
		if !seen[key] {
			rest = append(rest, key)
		}
	}
	sort.Strings(rest)
	for _, key := range rest {
		*params = append(*params, authParam{key, c.ExtraAuthParams[key]})
	}
}

func encodeAuthParams(params []authParam, spacesAsPercent bool) string {
	parts := make([]string, 0, len(params))
	for _, p := range params {
		key := url.QueryEscape(p.key)
		value := url.QueryEscape(p.value)
		if spacesAsPercent {
			key = strings.ReplaceAll(key, "+", "%20")
			value = strings.ReplaceAll(value, "+", "%20")
		}
		parts = append(parts, key+"="+value)
	}
	return strings.Join(parts, "&")
}

// SplitPastedCode separates a user-pasted authorization code from its trailing
// "#state" fragment. Claude's authorize response appends the state to the code
// (code#state) when the user copies it from the console page.
func SplitPastedCode(code string) (string, string) {
	if i := strings.Index(code, "#"); i >= 0 {
		return code[:i], code[i+1:]
	}
	return code, ""
}

// ExchangeCode swaps an authorization code for tokens. verifier is the PKCE
// verifier; state is the original OAuth state value, used as a fallback when
// the code doesn't carry an embedded #state fragment (Anthropic requires a
// state on its token exchange — without it the endpoint answers 400
// invalid_request "Invalid request format").
func (c ProviderConfig) ExchangeCode(ctx context.Context, code, redirectURI, verifier, state string) (*Tokens, error) {
	code, codeState := SplitPastedCode(code)

	form := url.Values{}
	form.Set("grant_type", "authorization_code")
	form.Set("client_id", c.ClientID)
	form.Set("code", code)
	form.Set("redirect_uri", redirectURI)
	if verifier != "" {
		form.Set("code_verifier", verifier)
	}
	if c.EchoState {
		if codeState == "" && state != "" {
			codeState = state
		}
		if codeState != "" {
			form.Set("state", codeState)
		}
	}

	raw, err := c.tokenRequest(ctx, c.TokenURL, form)
	if err != nil {
		return nil, err
	}
	tokens, err := mapTokenResponse(raw)
	if err != nil {
		return nil, err
	}
	c.applyTokenMetadata(tokens)
	// Best-effort: fetch the connected user's profile so the dashboard can
	// show a human-readable label (email / display name).
	c.FetchUserInfo(ctx, tokens)
	return tokens, nil
}

// Refresh exchanges a refresh token for a new access token. On failure the
// returned error is a *RefreshError when the token endpoint responded, so
// callers can use IsPermanentRefresh to decide whether re-authentication is
// needed.
func (c ProviderConfig) Refresh(ctx context.Context, refreshToken string) (*Tokens, error) {
	if refreshToken == "" {
		return nil, fmt.Errorf("oauth: no refresh token available")
	}
	form := url.Values{}
	form.Set("grant_type", "refresh_token")
	form.Set("client_id", c.ClientID)
	form.Set("refresh_token", refreshToken)

	raw, status, err := c.tokenRequestStatus(ctx, c.refreshURL(), form)
	if err != nil {
		return nil, err
	}
	if status >= 400 {
		return nil, classifyRefreshError(raw, status)
	}
	t, err := mapTokenResponse(raw)
	if err != nil {
		return nil, err
	}
	c.applyTokenMetadata(t)
	// Providers may omit a new refresh token; keep the existing one.
	if t.RefreshToken == "" {
		t.RefreshToken = refreshToken
	}
	return t, nil
}

// applyTokenMetadata derives provider-specific metadata from the ID token's
// JWT payload so the dashboard can identify the connected account.
func (c ProviderConfig) applyTokenMetadata(t *Tokens) {
	if t == nil {
		return
	}
	if t.Extra == nil {
		t.Extra = map[string]string{}
	}

	payload := decodeJWTPayload(t.IDToken)
	switch c.Provider {
	case "codex":
		if t.Email == "" {
			if email, _ := payload["email"].(string); email != "" {
				t.Email = email
			}
		}
		if auth, _ := payload["https://api.openai.com/auth"].(map[string]any); auth != nil {
			if accountID, _ := auth["chatgpt_account_id"].(string); accountID != "" {
				t.Extra["chatgpt_account_id"] = accountID
			}
			if planType, _ := auth["chatgpt_plan_type"].(string); planType != "" {
				t.Extra["chatgpt_plan_type"] = planType
			}
		}
		if accountID, _ := payload["account_id"].(string); accountID != "" && t.Extra["chatgpt_account_id"] == "" {
			t.Extra["chatgpt_account_id"] = accountID
		}
		if planType, _ := payload["plan_type"].(string); planType != "" && t.Extra["chatgpt_plan_type"] == "" {
			t.Extra["chatgpt_plan_type"] = planType
		}
	}

	if len(t.Extra) == 0 {
		t.Extra = nil
	}
}

func decodeJWTPayload(token string) map[string]any {
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return nil
	}
	payload, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		payload, err = base64.URLEncoding.DecodeString(parts[1])
		if err != nil {
			return nil
		}
	}
	var out map[string]any
	if err := json.Unmarshal(payload, &out); err != nil {
		return nil
	}
	return out
}

// tokenRequest posts a token-endpoint request and returns the body, erroring
// on non-2xx responses.
func (c ProviderConfig) tokenRequest(ctx context.Context, endpoint string, form url.Values) ([]byte, error) {
	raw, status, err := c.tokenRequestStatus(ctx, endpoint, form)
	if err != nil {
		return nil, err
	}
	if status >= 400 {
		return nil, fmt.Errorf("oauth: token endpoint returned %d: %s", status, truncate(raw, 300))
	}
	return raw, nil
}

// tokenRequestStatus posts a token request and returns the body + status,
// honoring the provider's content-type preference (Claude wants JSON).
func (c ProviderConfig) tokenRequestStatus(ctx context.Context, endpoint string, form url.Values) ([]byte, int, error) {
	var (
		req *http.Request
		err error
	)
	if c.TokenContentType == "json" {
		obj := map[string]string{}
		for k := range form {
			obj[k] = form.Get(k)
		}
		body, _ := json.Marshal(obj)
		req, err = http.NewRequestWithContext(ctx, http.MethodPost, endpoint, strings.NewReader(string(body)))
		if err == nil {
			req.Header.Set("Content-Type", "application/json")
		}
	} else {
		req, err = http.NewRequestWithContext(ctx, http.MethodPost, endpoint, strings.NewReader(form.Encode()))
		if err == nil {
			req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
		}
	}
	if err != nil {
		return nil, 0, fmt.Errorf("oauth: build token request: %w", err)
	}
	req.Header.Set("Accept", "application/json")

	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, 0, fmt.Errorf("oauth: token request: %w", err)
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, resp.StatusCode, fmt.Errorf("oauth: read token response: %w", err)
	}
	return body, resp.StatusCode, nil
}

// mapTokenResponse normalizes a standard OAuth token JSON body into Tokens.
func mapTokenResponse(raw []byte) (*Tokens, error) {
	var parsed struct {
		AccessToken      string `json:"access_token"`
		RefreshToken     string `json:"refresh_token"`
		IDToken          string `json:"id_token"`
		ExpiresIn        int    `json:"expires_in"`
		Scope            string `json:"scope"`
		Error            string `json:"error"`
		ErrorDescription string `json:"error_description"`
	}
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return nil, fmt.Errorf("oauth: parse token response: %w", err)
	}
	if parsed.Error != "" {
		return nil, fmt.Errorf("oauth: %s: %s", parsed.Error, parsed.ErrorDescription)
	}
	if parsed.AccessToken == "" {
		return nil, fmt.Errorf("oauth: token response missing access_token")
	}
	return &Tokens{
		AccessToken:  parsed.AccessToken,
		RefreshToken: parsed.RefreshToken,
		IDToken:      parsed.IDToken,
		ExpiresIn:    parsed.ExpiresIn,
		Scope:        parsed.Scope,
	}, nil
}

// FetchUserInfo calls the provider's userinfo endpoint to populate
// Tokens.Email and Tokens.DisplayName. Errors are swallowed — the account is
// still usable, just missing a human-readable label.
//
// Anthropic's /api/oauth/profile answers { email, display_name }; OpenAI's
// OIDC userinfo answers { email, name }.
func (c ProviderConfig) FetchUserInfo(ctx context.Context, t *Tokens) {
	if c.UserInfoURL == "" || t.AccessToken == "" {
		return
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.UserInfoURL, nil)
	if err != nil {
		return
	}
	req.Header.Set("Authorization", "Bearer "+t.AccessToken)
	req.Header.Set("Accept", "application/json")

	resp, err := httpClient.Do(req)
	if err != nil {
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return
	}
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return
	}

	var info struct {
		Email         string `json:"email"`
		Name          string `json:"name"`
		DisplayName   string `json:"display_name"`
		PreferredUser string `json:"preferred_username"`
	}
	_ = json.Unmarshal(body, &info)

	if t.Email == "" {
		t.Email = info.Email
	}
	if t.DisplayName == "" {
		t.DisplayName = info.DisplayName
		if t.DisplayName == "" {
			t.DisplayName = info.Name
		}
		if t.DisplayName == "" {
			t.DisplayName = info.PreferredUser
		}
	}
}

func truncate(b []byte, max int) string {
	s := strings.TrimSpace(string(b))
	if len(s) > max {
		return s[:max] + "…"
	}
	return s
}
