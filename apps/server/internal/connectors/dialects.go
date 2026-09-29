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
		if hasResponsesSuffix(base) {
			return base
		}
		return joinURL(base, "responses")
	default:
		return joinURL(base, "chat/completions")
	}
}

// hasResponsesSuffix reports whether a base URL already targets /responses.
func hasResponsesSuffix(u string) bool {
	const suf = "/responses"
	return strings.HasSuffix(strings.TrimRight(u, "/"), suf)
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
		h["Authorization"] = bearer(tok)
	}
	return mergeHeaders(h, creds.Headers)
}

// anthropicVersion is the API version Anthropic requires on every call.
const anthropicVersion = "2023-06-01"

// anthropicHeaders authenticates an Anthropic Messages call: API keys go in
// x-api-key, OAuth access tokens in Authorization.
func (c *connector) anthropicHeaders(creds core.Credentials) map[string]string {
	h := map[string]string{"anthropic-version": anthropicVersion}
	switch {
	case creds.APIKey != "":
		h["x-api-key"] = creds.APIKey
	case creds.AccessToken != "":
		h["Authorization"] = bearer(creds.AccessToken)
	}
	return mergeHeaders(h, creds.Headers)
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
