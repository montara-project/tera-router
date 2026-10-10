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

// clineClientVersion is the Cline release the gateway identifies as, kept in
// step with the current `cline` npm release. Cline's gateway answers 403
// ("only available via Cline product surfaces") to clients it does not
// recognise as current.
const clineClientVersion = "3.0.70"

// ClineHeaders returns the auth and identification headers for a Cline call.
// Cline's gateway requires its SDK's identification headers — without them
// every cline-free model answers 403 "only available via Cline product
// surfaces" — and a workos: token prefix (WorkOS-backed auth) unless the
// operator stored an already-prefixed or native sk_ key.
func ClineHeaders(tok string) map[string]string {
	if !strings.HasPrefix(tok, "workos:") && !strings.HasPrefix(tok, "sk_") {
		tok = "workos:" + tok
	}
	return map[string]string{
		"Authorization":      bearer(tok),
		"User-Agent":         "Cline/" + clineClientVersion,
		"HTTP-Referer":       "https://cline.bot",
		"X-Title":            "Cline",
		"X-CLIENT-TYPE":      "cline-sdk",
		"X-PLATFORM":         "web",
		"X-IS-MULTIROOT":     "false",
		"X-CLIENT-VERSION":   clineClientVersion,
		"X-CORE-VERSION":     clineClientVersion,
		"X-PLATFORM-VERSION": clineClientVersion,
	}
}

// openAIHeaders authenticates an OpenAI Chat Completions call. An empty token
// (AuthNone providers) sends no auth header at all.
func (c *connector) openAIHeaders(creds core.Credentials) map[string]string {
	h := map[string]string{}
	if tok := creds.Token(); tok != "" {
		if c.id == "cline" {
			return mergeHeaders(ClineHeaders(tok), creds.Headers)
		}
		h["Authorization"] = bearer(tok)
	}
	return mergeHeaders(h, creds.Headers)
}

// Anthropic API constants. AnthropicVersion is required on every call.
// Subscription (OAuth) access tokens additionally need AnthropicOAuthBeta and
// ClaudeCodeSystemPrompt as the leading system block: without the prompt,
// Sonnet/Opus answer 429 rate_limit_error while Haiku still succeeds.
const (
	AnthropicVersion       = "2023-06-01"
	AnthropicOAuthBeta     = "oauth-2025-04-20"
	ClaudeCodeSystemPrompt = "You are Claude Code, Anthropic's official CLI for Claude."
)

// anthropicOAuth reports whether an Anthropic attempt authenticates with an
// OAuth access token rather than an API key.
func anthropicOAuth(creds core.Credentials) bool {
	return creds.APIKey == "" && creds.AccessToken != ""
}

// anthropicHeaders authenticates an Anthropic Messages call: API keys go in
// x-api-key, OAuth access tokens in Authorization plus the oauth beta header
// Anthropic requires for bearer tokens.
func (c *connector) anthropicHeaders(creds core.Credentials) map[string]string {
	h := map[string]string{"anthropic-version": AnthropicVersion}
	oauth := anthropicOAuth(creds)
	switch {
	case creds.APIKey != "":
		h["x-api-key"] = creds.APIKey
	case oauth:
		h["Authorization"] = bearer(creds.AccessToken)
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
