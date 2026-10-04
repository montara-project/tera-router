package oauth

import (
	"fmt"
	"net/url"
)

// ProviderConfig holds the OAuth endpoints and client identity for one
// provider. The client ids are the public values published by the upstream
// CLIs (Claude Code, Codex CLI); they are not secrets in the confidential
// sense.
type ProviderConfig struct {
	// Provider is the catalog provider slug this config authenticates.
	Provider string
	Flow     FlowType

	ClientID string

	AuthorizeURL string // authorization_code(_pkce)
	TokenURL     string
	RefreshURL   string // defaults to TokenURL when empty

	// Scopes is space-joined into the request.
	Scopes []string
	// ExtraAuthParams are appended to the authorize URL (provider quirks).
	ExtraAuthParams map[string]string
	// ExtraAuthParamOrder preserves provider-specific parameter order when the
	// authorize URL needs CLI-compatible percent encoding.
	ExtraAuthParamOrder []string
	// EncodeAuthSpacesAsPercent mirrors CLIs that build authorize URLs with
	// encodeURIComponent, where spaces become %20 rather than +.
	EncodeAuthSpacesAsPercent bool
	// TokenContentType is "form" (x-www-form-urlencoded, default) or "json".
	TokenContentType string

	// CallbackPath and FixedLoopbackPort mirror CLI OAuth loopback callbacks.
	// Providers with FixedLoopbackPort set ignore the dashboard-provided
	// redirect host and use http://LoopbackHost:FixedLoopbackPort/CallbackPath.
	// FallbackPorts are tried in order when FixedLoopbackPort is busy; Codex's
	// OAuth app allow-lists 1457 beside 1455, so a busy 1455 still signs in.
	CallbackPath      string
	FixedLoopbackPort int
	FallbackPorts     []int
	LoopbackHost      string

	// FixedRedirectURI pins the redirect to the one URI the provider's OAuth
	// app allow-lists, ignoring the dashboard-provided origin entirely.
	// Claude/Anthropic reuse Anthropic's public client id, whose app only
	// accepts its own console callback and loopback hosts — a deployed
	// dashboard can never receive the browser redirect. The console page
	// therefore displays the code for the user to paste into the exchange
	// endpoint (SplitPastedCode), like a headless CLI sign-in.
	FixedRedirectURI string

	// UserInfoURL is the endpoint called after token exchange to retrieve the
	// connected user's email and display name. When empty, no profile fetch
	// is attempted and the account label falls back to the provider name.
	UserInfoURL string

	// AccountProvider is the catalog slug the connected account is attributed
	// to when it differs from Provider — Codex tokens serve the ChatGPT
	// backend, so an "openai" flow still stores its account under the hidden
	// "codex" provider. Empty means the account uses Provider itself.
	AccountProvider string
}

// accountProvider returns the catalog slug accounts from this flow are
// attributed to.
func (c ProviderConfig) AccountSlug() string {
	if c.AccountProvider != "" {
		return c.AccountProvider
	}
	return c.Provider
}

// refreshURL returns the configured refresh URL, defaulting to TokenURL.
func (c ProviderConfig) refreshURL() string {
	if c.RefreshURL != "" {
		return c.RefreshURL
	}
	return c.TokenURL
}

// ResolveRedirectURI returns the redirect URI that should be registered for a
// flow. Providers with FixedRedirectURI always use it; CLI-mirrored providers
// such as Codex require an exact fixed loopback URI; the remaining providers
// rewrite the requested dashboard URI's path to the callback path while
// preserving its origin.
//
// port overrides the configured fixed port when > 0: a busy preferred port may
// have fallen back to an alternative the provider's OAuth app also allows.
func (c ProviderConfig) ResolveRedirectURI(requested string, port int) string {
	if c.FixedRedirectURI != "" {
		return c.FixedRedirectURI
	}

	path := c.CallbackPath
	if path == "" {
		path = "/callback"
	}

	if c.FixedLoopbackPort > 0 {
		host := c.LoopbackHost
		if host == "" {
			host = "127.0.0.1"
		}
		if port <= 0 {
			port = c.FixedLoopbackPort
		}
		return fmt.Sprintf("http://%s:%d%s", host, port, path)
	}

	u, err := url.Parse(requested)
	if err != nil {
		return requested
	}
	u.Path = path
	u.RawQuery = ""
	u.Fragment = ""
	return u.String()
}

// configs maps provider slug -> OAuth config. The claude/codex keys are the
// original subscription providers; the openai/anthropic aliases let the
// dashboard start the same flows from the OpenAI and Anthropic catalog tiles'
// "sign in to official website" option. Both sets are accepted.
var configs = map[string]ProviderConfig{
	"claude": {
		Provider:         "claude",
		Flow:             FlowAuthCodePKCE,
		ClientID:         "9d1c250a-e61b-44d9-88ed-5944d1962f5e",
		AuthorizeURL:     "https://claude.ai/oauth/authorize",
		TokenURL:         "https://api.anthropic.com/v1/oauth/token",
		Scopes:           []string{"org:create_api_key", "user:profile", "user:inference"},
		// Claude's token endpoint expects a JSON body and echoes the state.
		TokenContentType: "json",
		ExtraAuthParams:  map[string]string{"code": "true"},
		UserInfoURL:      "https://api.anthropic.com/v1/me",
		FixedRedirectURI: "https://console.anthropic.com/oauth/code/callback",
	},
	"codex": {
		Provider:                  "codex",
		Flow:                      FlowAuthCodePKCE,
		ClientID:                  "app_EMoamEEZ73f0CkXaXp7hrann",
		AuthorizeURL:              "https://auth.openai.com/oauth/authorize",
		TokenURL:                  "https://auth.openai.com/oauth/token",
		Scopes:                    []string{"openid", "profile", "email", "offline_access"},
		ExtraAuthParams:           map[string]string{"id_token_add_organizations": "true", "codex_cli_simplified_flow": "true", "originator": "codex_cli_rs"},
		ExtraAuthParamOrder:       []string{"id_token_add_organizations", "codex_cli_simplified_flow", "originator"},
		EncodeAuthSpacesAsPercent: true,
		CallbackPath:              "/auth/callback",
		FixedLoopbackPort:         1455,
		FallbackPorts:             []int{1457},
		LoopbackHost:              "localhost",
		UserInfoURL:               "https://auth.openai.com/oauth/userinfo",
	},
	"anthropic": {
		Provider:         "anthropic",
		AccountProvider:  "anthropic",
		Flow:             FlowAuthCodePKCE,
		ClientID:         "9d1c250a-e61b-44d9-88ed-5944d1962f5e",
		AuthorizeURL:     "https://claude.ai/oauth/authorize",
		TokenURL:         "https://api.anthropic.com/v1/oauth/token",
		Scopes:           []string{"org:create_api_key", "user:profile", "user:inference"},
		TokenContentType: "json",
		ExtraAuthParams:  map[string]string{"code": "true"},
		UserInfoURL:      "https://api.anthropic.com/v1/me",
		FixedRedirectURI: "https://console.anthropic.com/oauth/code/callback",
	},
	"openai": {
		Provider:                  "openai",
		AccountProvider:           "codex",
		Flow:                      FlowAuthCodePKCE,
		ClientID:                  "app_EMoamEEZ73f0CkXaXp7hrann",
		AuthorizeURL:              "https://auth.openai.com/oauth/authorize",
		TokenURL:                  "https://auth.openai.com/oauth/token",
		Scopes:                    []string{"openid", "profile", "email", "offline_access"},
		ExtraAuthParams:           map[string]string{"id_token_add_organizations": "true", "codex_cli_simplified_flow": "true", "originator": "codex_cli_rs"},
		ExtraAuthParamOrder:       []string{"id_token_add_organizations", "codex_cli_simplified_flow", "originator"},
		EncodeAuthSpacesAsPercent: true,
		CallbackPath:              "/auth/callback",
		FixedLoopbackPort:         1455,
		FallbackPorts:             []int{1457},
		LoopbackHost:              "localhost",
		UserInfoURL:               "https://auth.openai.com/oauth/userinfo",
	},
}

// ConfigFor returns the OAuth config for a provider slug.
func ConfigFor(provider string) (ProviderConfig, bool) {
	c, ok := configs[provider]
	return c, ok
}

// SupportedProviders lists provider slugs with an OAuth config, for discovery.
func SupportedProviders() []string {
	out := make([]string, 0, len(configs))
	for id := range configs {
		out = append(out, id)
	}
	return out
}
