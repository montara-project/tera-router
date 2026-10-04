package oauth

import (
	"encoding/base64"
	"strings"
	"testing"
)

// The provider configs are the wire contract with the upstream OAuth apps —
// the client ids, endpoints, and quirks below must not drift.
func TestProviderConfigs(t *testing.T) {
	claude, ok := ConfigFor("claude")
	if !ok {
		t.Fatal("no config for claude")
	}
	if claude.ClientID != "9d1c250a-e61b-44d9-88ed-5944d1962f5e" {
		t.Errorf("claude client id = %q", claude.ClientID)
	}
	if claude.TokenContentType != "json" {
		t.Errorf("claude token content type = %q, want json", claude.TokenContentType)
	}
	if claude.refreshURL() != claude.TokenURL {
		t.Errorf("claude refresh url = %q, want the token url", claude.refreshURL())
	}

	codex, ok := ConfigFor("codex")
	if !ok {
		t.Fatal("no config for codex")
	}
	if codex.FixedLoopbackPort != 1455 {
		t.Errorf("codex fixed port = %d, want 1455", codex.FixedLoopbackPort)
	}
	if got := codex.ResolveRedirectURI("http://ignored.example/cb", 0); got != "http://localhost:1455/auth/callback" {
		t.Errorf("codex redirect = %q", got)
	}
	if got := codex.ResolveRedirectURI("", 1457); got != "http://localhost:1457/auth/callback" {
		t.Errorf("codex fallback redirect = %q, want the 1457 fallback", got)
	}
	// Claude's OAuth app only allow-lists Anthropic's own console callback
	// (plus loopback hosts it can't use from a deployed dashboard), so the
	// redirect is pinned to the console display-code URI regardless of what
	// the dashboard requests.
	if got := claude.ResolveRedirectURI("http://localhost:5173/whatever?x=1", 0); got != "https://console.anthropic.com/oauth/code/callback" {
		t.Errorf("claude redirect = %q, want Anthropic's console display-code callback", got)
	}

	// The catalog-tile aliases reuse the subscription flows: OpenAI's
	// "sign in to official website" runs the Codex flow but must attribute
	// its account to the hidden codex provider, while Anthropic's stays on
	// the anthropic catalog provider.
	openai, ok := ConfigFor("openai")
	if !ok {
		t.Fatal("no config for openai")
	}
	if openai.AccountSlug() != "codex" {
		t.Errorf("openai account slug = %q, want codex", openai.AccountSlug())
	}
	if openai.ClientID != codex.ClientID || openai.FixedLoopbackPort != codex.FixedLoopbackPort {
		t.Errorf("openai flow drifts from codex: %+v", openai)
	}
	anthropic, ok := ConfigFor("anthropic")
	if !ok {
		t.Fatal("no config for anthropic")
	}
	if anthropic.AccountSlug() != "anthropic" {
		t.Errorf("anthropic account slug = %q, want anthropic", anthropic.AccountSlug())
	}
	if anthropic.ClientID != claude.ClientID || anthropic.AuthorizeURL != claude.AuthorizeURL {
		t.Errorf("anthropic flow drifts from claude: %+v", anthropic)
	}
}

// The claude authorize URL carries its quirks: the code=true param, the
// space-joined scopes, and S256 PKCE.
func TestClaudeAuthURL(t *testing.T) {
	claude, _ := ConfigFor("claude")
	u := claude.AuthURL("http://localhost:5173/callback", "state-1", "challenge-1")

	for _, want := range []string{
		"https://claude.ai/oauth/authorize?",
		"response_type=code",
		"client_id=9d1c250a-e61b-44d9-88ed-5944d1962f5e",
		"scope=org%3Acreate_api_key+user%3Aprofile+user%3Ainference",
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
	pkce, err := GeneratePKCE(32)
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
