package oauth

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// The provider configs are the wire contract with the upstream OAuth apps —
// the client ids, endpoints, and quirks below must not drift.
func TestProviderConfigs(t *testing.T) {
	anthropic, ok := ConfigFor("anthropic")
	if !ok {
		t.Fatal("no config for anthropic")
	}
	if anthropic.ClientID != "9d1c250a-e61b-44d9-88ed-5944d1962f5e" {
		t.Errorf("anthropic client id = %q", anthropic.ClientID)
	}
	if anthropic.TokenContentType != "json" {
		t.Errorf("anthropic token content type = %q, want json", anthropic.TokenContentType)
	}
	// The claude.ai grant validates against the console's OAuth service, and
	// the exchange must echo the state — api.anthropic.com answers 400
	// "Invalid request format" without it.
	if anthropic.TokenURL != "https://console.anthropic.com/v1/oauth/token" {
		t.Errorf("anthropic token url = %q", anthropic.TokenURL)
	}
	if !anthropic.EchoState {
		t.Errorf("anthropic echo state = false, want true")
	}
	// Anthropic's OAuth app only allow-lists its own console callback, so the
	// redirect is pinned to the console display-code URI.
	if got := anthropic.ResolveRedirectURI(0); got != "https://console.anthropic.com/oauth/code/callback" {
		t.Errorf("anthropic redirect = %q, want Anthropic's console display-code callback", got)
	}

	codex, ok := ConfigFor("codex")
	if !ok {
		t.Fatal("no config for codex")
	}
	if codex.FixedLoopbackPort != 1455 {
		t.Errorf("codex fixed port = %d, want 1455", codex.FixedLoopbackPort)
	}
	if got := codex.ResolveRedirectURI(0); got != "http://localhost:1455/auth/callback" {
		t.Errorf("codex redirect = %q", got)
	}
	if got := codex.ResolveRedirectURI(1457); got != "http://localhost:1457/auth/callback" {
		t.Errorf("codex fallback redirect = %q, want the 1457 fallback", got)
	}
}

// The token exchange must echo the state (the pasted "#state" fragment wins,
// then the flow's state) only for configs that opt in — Anthropic answers 400
// "Invalid request format" without it.
func TestExchangeCodeEchoesState(t *testing.T) {
	var got map[string]any
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewDecoder(r.Body).Decode(&got)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"access_token":"at","refresh_token":"rt","expires_in":3600}`))
	}))
	defer srv.Close()

	cfg := ProviderConfig{
		Provider:         "anthropic",
		ClientID:         "client-1",
		TokenURL:         srv.URL,
		TokenContentType: "json",
		EchoState:        true,
	}
	if _, err := cfg.ExchangeCode(context.Background(), "code-1#state-9", "https://console.example/cb", "verifier-1", "state-9"); err != nil {
		t.Fatalf("exchange: %v", err)
	}
	for k, want := range map[string]any{
		"grant_type":    "authorization_code",
		"client_id":     "client-1",
		"code":          "code-1",
		"state":         "state-9",
		"redirect_uri":  "https://console.example/cb",
		"code_verifier": "verifier-1",
	} {
		if got[k] != want {
			t.Errorf("exchange body[%q] = %v, want %v", k, got[k], want)
		}
	}

	got = nil
	cfg.EchoState = false
	if _, err := cfg.ExchangeCode(context.Background(), "code-1", "https://console.example/cb", "verifier-1", "state-9"); err != nil {
		t.Fatalf("exchange: %v", err)
	}
	if _, ok := got["state"]; ok {
		t.Errorf("exchange body carried state without EchoState: %v", got)
	}
}

// The anthropic authorize URL carries its quirks: the code=true param, the
// space-joined scopes, and S256 PKCE.
func TestAnthropicAuthURL(t *testing.T) {
	anthropic, _ := ConfigFor("anthropic")
	u := anthropic.AuthURL("https://console.anthropic.com/oauth/code/callback", "state-1", "challenge-1")

	for _, want := range []string{
		"https://claude.ai/oauth/authorize?",
		"response_type=code",
		"client_id=9d1c250a-e61b-44d9-88ed-5944d1962f5e",
		"scope=org%3Acreate_api_key%20user%3Aprofile%20user%3Ainference",
		"code_challenge=challenge-1",
		"code_challenge_method=S256",
		"code=true",
		"state=state-1",
	} {
		if !strings.Contains(u, want) {
			t.Errorf("authorize URL missing %q: %s", want, u)
		}
	}
}

// Codex mirrors the Codex CLI's authorize URL: ordered extra params and
// %20-encoded spaces in the scope list.
func TestCodexAuthURL(t *testing.T) {
	codex, _ := ConfigFor("codex")
	u := codex.AuthURL("http://localhost:1455/auth/callback", "state-2", "challenge-2")

	for _, want := range []string{
		"scope=openid%20profile%20email%20offline_access",
		"id_token_add_organizations=true",
		"codex_cli_simplified_flow=true",
		"originator=codex_cli_rs",
		"state=state-2",
	} {
		if !strings.Contains(u, want) {
			t.Errorf("authorize URL missing %q: %s", want, u)
		}
	}
	if strings.Contains(u, "+") {
		t.Errorf("codex authorize URL must encode spaces as %%20: %s", u)
	}
}

func TestGeneratePKCE(t *testing.T) {
	pkce, err := GeneratePKCE()
	if err != nil {
		t.Fatalf("generate: %v", err)
	}
	if pkce.Verifier == "" || pkce.Challenge == "" || pkce.State == "" {
		t.Fatalf("incomplete pkce: %+v", pkce)
	}
	if len(pkce.State) < 40 {
		t.Errorf("state entropy too low: %q", pkce.State)
	}
}

// Claude appends "#state" to the pasted code; the exchange must split it and
// use the fragment (or the original state) as the token-request state.
func TestSplitPastedCode(t *testing.T) {
	code, state := SplitPastedCode("abc#state-9")
	if code != "abc" || state != "state-9" {
		t.Errorf("split = %q/%q, want abc/state-9", code, state)
	}
	code, state = SplitPastedCode("plain")
	if code != "plain" || state != "" {
		t.Errorf("split = %q/%q, want plain/empty", code, state)
	}
}

func TestClassifyRefreshError(t *testing.T) {
	// OpenAI's nested error object.
	err := classifyRefreshError([]byte(`{"error":{"message":"token revoked","code":"token_revoked"}}`), 400)
	if !err.Permanent || err.Code != "token_revoked" {
		t.Errorf("nested error = %+v, want permanent token_revoked", err)
	}

	// Standard string error with a transient status stays retryable.
	err = classifyRefreshError([]byte(`{"error":"temporarily_unavailable"}`), 503)
	if err.Permanent {
		t.Errorf("503 classified permanent: %+v", err)
	}

	// 401 with no recognized error code is transient: a bare 401 does not
	// prove the refresh token is dead (some auth servers answer 401 during
	// outages), so it must not force re-authentication.
	err = classifyRefreshError([]byte(`{}`), 401)
	if err.Permanent {
		t.Errorf("401 classified permanent: %+v", err)
	}
}

// The codex ID-token claims must surface as account metadata.
func TestCodexTokenMetadata(t *testing.T) {
	codex, _ := ConfigFor("codex")
	tokens := &Tokens{
		IDToken: "header." + base64URL(`{"email":"dev@example.com","https://api.openai.com/auth":{"chatgpt_account_id":"acc-1","chatgpt_plan_type":"pro"}}`) + ".sig",
	}
	codex.applyTokenMetadata(tokens)
	if tokens.Email != "dev@example.com" {
		t.Errorf("email = %q", tokens.Email)
	}
	if tokens.Extra["chatgpt_account_id"] != "acc-1" || tokens.Extra["chatgpt_plan_type"] != "pro" {
		t.Errorf("extra = %+v", tokens.Extra)
	}
}

func base64URL(s string) string {
	return base64.RawURLEncoding.EncodeToString([]byte(s))
}
