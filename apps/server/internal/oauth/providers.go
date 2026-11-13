package oauth

import "fmt"

// ProviderConfig holds the OAuth endpoints and client identity for one
// provider. The client ids are the public values published by the upstream
// CLIs (Claude Code, Codex CLI); they are not secrets in the confidential
// sense.
type ProviderConfig struct {
	// Provider is the catalog provider slug this config authenticates.
	Provider string

	ClientID string

	AuthorizeURL string // authorization_code + PKCE
	TokenURL     string

	// Scopes is space-joined into the request.
	Scopes []string
	// ExtraAuthParams are appended to the authorize URL in order (provider
	// quirks).
	ExtraAuthParams []authParam
	// TokenContentType is "form" (x-www-form-urlencoded, default) or "json".
	TokenContentType string

	// CallbackPath and FixedLoopbackPort mirror CLI OAuth loopback callbacks.
	// FixedLoopbackPort is the port the listener prefers; FallbackPorts are
	// tried in order when it is busy (Codex's OAuth app allow-lists 1457
	// beside 1455, so a busy 1455 still signs in).
	CallbackPath      string
	FixedLoopbackPort int
	FallbackPorts     []int
	LoopbackHost      string

	// FixedRedirectURI pins the redirect to the one URI the provider's OAuth
	// app allow-lists. Anthropic's public client id only accepts its own
	// console callback, so the console page displays the code for the user to
	// paste into the exchange endpoint (SplitPastedCode), like a headless CLI
	// sign-in.
	FixedRedirectURI string

	// UserInfoURL is the endpoint called after token exchange to retrieve the
	// connected user's email and display name. When empty, no profile fetch
	// is attempted and the account label falls back to the provider name.
	UserInfoURL string

	// Device flow (ZCode): instead of redirecting back with a code, the
	// provider hands out an authorize_url the user visits while the server
	// polls a flow endpoint until the grant is ready. DeviceInitURL starts the
	// flow, DevicePollURL (plus "/" + flow id) is polled for the result.
	DeviceInitURL string
	DevicePollURL string
	// TokenBodyProvider is the value of the "provider" field the provider's
	// token endpoints require in the request body (ZCode: "zai"). Empty means
	// no such field.
	TokenBodyProvider string
	// TokenResponseWrapped reports a token endpoint that wraps the standard
	// token object in {"data":{"token":…}} instead of answering at the top
	// level (ZCode does).
	TokenResponseWrapped bool

	// EchoState includes the OAuth state in the token-exchange body. The
	// Anthropic token endpoint answers 400 invalid_request "Invalid request
	// format" without it; the echoed state prefers the "#state" fragment of
	// a pasted code and falls back to the state the flow started with.
	EchoState bool

	// Buddy marks a provider of Tencent's buddy family (WorkBuddy, CodeBuddy,
	// CodeBuddy CN): the realm's host and client identity drive its device
	// sign-in and its header-based token refresh. A config carrying a Buddy
	// realm is a device-flow provider.
	Buddy *BuddyRealm
}

// DeviceFlow reports whether this provider signs in through the device flow
// (init + authorize_url + poll) instead of the authorization-code redirect.
func (c ProviderConfig) DeviceFlow() bool {
	return c.DeviceInitURL != "" || c.Buddy != nil
}

// ResolveRedirectURI returns the redirect URI registered for a flow: the
// pinned FixedRedirectURI when set, otherwise the fixed loopback listener's
// URL.
//
// port overrides the configured fixed port when > 0: a busy preferred port may
// have fallen back to an alternative the provider's OAuth app also allows.
func (c ProviderConfig) ResolveRedirectURI(port int) string {
	if c.FixedRedirectURI != "" {
		return c.FixedRedirectURI
	}
	if port <= 0 {
		port = c.FixedLoopbackPort
	}
	return fmt.Sprintf("http://%s:%d%s", c.LoopbackHost, port, c.CallbackPath)
}

// configs maps provider slug -> OAuth config: the two subscription providers,
// started from their catalog tile's "sign in to official website" option.
var configs = map[string]ProviderConfig{
	"anthropic": {
		Provider:     "anthropic",
		ClientID:     "9d1c250a-e61b-44d9-88ed-5944d1962f5e",
		AuthorizeURL: "https://claude.ai/oauth/authorize",
		// The claude.ai-issued grant validates against the console's OAuth
		// service; api.anthropic.com hosts the separate API-workload OAuth
		// and rejects these codes with invalid_grant.
		TokenURL:         "https://console.anthropic.com/v1/oauth/token",
		Scopes:           []string{"org:create_api_key", "user:profile", "user:inference"},
		ExtraAuthParams:  []authParam{{"code", "true"}},
		TokenContentType: "json",
		EchoState:        true,
		UserInfoURL:      "https://api.anthropic.com/api/oauth/profile",
		FixedRedirectURI: "https://console.anthropic.com/oauth/code/callback",
	},
	"codex": {
		Provider:     "codex",
		ClientID:     "app_EMoamEEZ73f0CkXaXp7hrann",
		AuthorizeURL: "https://auth.openai.com/oauth/authorize",
		TokenURL:     "https://auth.openai.com/oauth/token",
		Scopes:       []string{"openid", "profile", "email", "offline_access"},
		ExtraAuthParams: []authParam{
			{"id_token_add_organizations", "true"},
			{"codex_cli_simplified_flow", "true"},
			{"originator", "codex_cli_rs"},
		},
		CallbackPath:      "/auth/callback",
		FixedLoopbackPort: 1455,
		FallbackPorts:     []int{1457},
		LoopbackHost:      "localhost",
		UserInfoURL:       "https://auth.openai.com/oauth/userinfo",
	},
	// ZCode signs in through a device flow rather than a code redirect: the
	// server opens the flow, the user approves on zcode.z.ai, and the server
	// polls the flow until it reports ready. Token endpoints want a "provider"
	// body field and wrap the token object in {"data":{"token":…}}. The plan
	// access token carries no exp claim — it is valid until revoked, and a
	// 401 upstream means re-login (token_version bump), not refresh.
	"zcode": {
		Provider:             "zcode",
		TokenURL:             "https://zcode.z.ai/api/v1/oauth/token",
		DeviceInitURL:        "https://zcode.z.ai/api/v1/oauth/cli/init",
		DevicePollURL:        "https://zcode.z.ai/api/v1/oauth/cli/poll",
		TokenContentType:     "json",
		TokenBodyProvider:    "zai",
		TokenResponseWrapped: true,
	},
	// The buddy family signs in the same way: the server asks for a state and
	// a browser URL, the user approves on the realm's own site, and the server
	// polls the state until the grant lands. Only host and client identity
	// differ between the three realms, so they share one flow implementation.
	"workbuddy": {
		Provider: "workbuddy",
		Buddy:    &BuddyRealm{Host: "https://www.workbuddy.ai", Domain: "www.workbuddy.ai", Platform: "workbuddy-ai", ClientVersion: workbuddyClientVersion, IDE: "WorkBuddy"},
	},
	"codebuddy": {
		Provider: "codebuddy",
		Buddy:    &BuddyRealm{Host: "https://www.codebuddy.ai", Domain: "www.codebuddy.ai", Platform: "CLI", ClientVersion: codebuddyClientVersion, IDE: "CLI"},
	},
	"codebuddy-cn": {
		Provider: "codebuddy-cn",
		Buddy:    &BuddyRealm{Host: "https://copilot.tencent.com", Domain: "copilot.tencent.com", Platform: "CLI", ClientVersion: codebuddyClientVersion, IDE: "CLI"},
	},
}

// ConfigFor returns the OAuth config for a provider slug.
func ConfigFor(provider string) (ProviderConfig, bool) {
	c, ok := configs[provider]
	return c, ok
}
