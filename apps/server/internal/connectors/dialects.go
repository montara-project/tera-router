package connectors

import (
	"strings"

	"tera-router/server/internal/core"
)

// endpoint returns the upstream URL for an attempt: the per-account base URL
// when set, otherwise the connector's default from the catalog.
func (c *connector) endpoint(creds core.Credentials) string {
	base := baseURL(c.defaultBase, creds)
	switch c.dialect {
	case core.DialectAnthropic:
		return joinURL(base, "messages")
	case core.DialectOpenAIResponses:
		// The Codex catalog entry already points at ".../responses"; a plain
		// "https://api.openai.com/v1" base must gain the suffix.
		if strings.HasSuffix(strings.TrimRight(base, "/"), "/responses") {
			return base
		}
		return joinURL(base, "responses")
	default:
		return joinURL(base, "chat/completions")
	}
}

// headers returns the upstream auth and identification headers for an attempt.
func (c *connector) headers(creds core.Credentials) map[string]string {
	switch c.dialect {
	case core.DialectAnthropic:
		return c.anthropicHeaders(creds)
	case core.DialectOpenAIResponses:
		return c.responsesHeaders(creds)
	default:
		return c.openAIHeaders(creds)
	}
}

// openAIHeaders authenticates an OpenAI Chat Completions call. An empty token
// (AuthNone providers) sends no auth header at all.
func (c *connector) openAIHeaders(creds core.Credentials) map[string]string {
	h := map[string]string{}
	if tok := creds.Token(); tok != "" {
		if c.id == "cline" {
			// Cline's gateway requires its SDK's identification headers and a
			// workos: token prefix (WorkOS-backed auth) unless the operator
			// stored an already-prefixed or native sk_ key.
			if !strings.HasPrefix(tok, "workos:") && !strings.HasPrefix(tok, "sk_") {
				tok = "workos:" + tok
			}
			h["Authorization"] = bearer(tok)
			h["HTTP-Referer"] = "https://cline.bot"
			h["X-Title"] = "Cline"
			h["X-CLIENT-TYPE"] = "cline-sdk"
			h["X-PLATFORM"] = "web"
			h["X-IS-MULTIROOT"] = "false"
			h["X-CLIENT-VERSION"] = "3.0.46"
			h["X-CORE-VERSION"] = "3.0.46"
			h["X-PLATFORM-VERSION"] = "unknown"
			return mergeHeaders(h, creds.Headers)
		}
		h["Authorization"] = bearer(tok)
	}
	return mergeHeaders(h, creds.Headers)
}

// Anthropic API constants. AnthropicVersion is required on every call;
// AnthropicOAuthBeta is required when the bearer is an OAuth access token
// rather than an API key.
const (
	AnthropicVersion   = "2023-06-01"
	AnthropicOAuthBeta = "oauth-2025-04-20"
)

// anthropicHeaders authenticates an Anthropic Messages call: API keys go in
// x-api-key, OAuth access tokens in Authorization plus the oauth beta header
// Anthropic requires for bearer tokens.
func (c *connector) anthropicHeaders(creds core.Credentials) map[string]string {
	h := map[string]string{"anthropic-version": AnthropicVersion}
	oauth := false
	switch {
	case creds.APIKey != "":
		h["x-api-key"] = creds.APIKey
	case creds.AccessToken != "":
		h["Authorization"] = bearer(creds.AccessToken)
		oauth = true
	}
	merged := mergeHeaders(h, creds.Headers)
	if oauth {
		// Anthropic requires the oauth beta flag for bearer tokens. An
		// operator-supplied anthropic-beta (any casing) is combined, not
		// clobbered.
		key, existing := "", ""
		for k, v := range merged {
			if strings.EqualFold(k, "anthropic-beta") {
				key, existing = k, v
				break
			}
		}
		switch {
		case key == "":
			merged["anthropic-beta"] = AnthropicOAuthBeta
		case !strings.Contains(existing, AnthropicOAuthBeta):
			merged[key] = AnthropicOAuthBeta + "," + existing
		}
	}
	return merged
}

// responsesHeaders authenticates an OpenAI Responses call. The Codex backend
// additionally requires the Codex CLI's identification headers; the
// chatgpt-account-id it also demands is account-specific and arrives (when the
// operator has it) via creds.Headers, which is merged below.
func (c *connector) responsesHeaders(creds core.Credentials) map[string]string {
	h := map[string]string{}
	if tok := creds.Token(); tok != "" {
		h["Authorization"] = bearer(tok)
	}
	if c.id == "codex" {
		h["x-codex-client-version"] = "1.0.0"
		h["user-agent"] = "Codex/1.0.0 (Windows; x64; en-US)"
		h["origin"] = "https://chatgpt.com"
		h["referer"] = "https://chatgpt.com/"
		h["originator"] = "codex_cli_rs"
	}
	return mergeHeaders(h, creds.Headers)
}
