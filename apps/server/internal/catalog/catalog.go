// Package catalog holds the built-in provider specs shared by the dashboard
// (providers page, credential probes) and the inference gateway (upstream
// endpoint and wire dialect per provider).
package catalog

import "tera-router/server/internal/dtos"

// Upstream wire dialects a provider can speak. They match core.Dialect values;
// an empty dialect means the provider is listed for account management but is
// not routable by the gateway yet.
const (
	dialectOpenAI          = "openai"
	dialectAnthropic       = "anthropic"
	dialectOpenAIResponses = "openai_responses"
)

func llmCaps(extra ...string) []string {
	return append([]string{"chat"}, extra...)
}

// All returns the built-in provider specs.
func All() []dtos.CatalogProvider {
	return []dtos.CatalogProvider{
		{Slug: "custom-openai", Name: "Custom (OpenAI-compatible)", Dialect: dialectOpenAI, Capabilities: llmCaps("embeddings", "image", "tts", "stt"), AuthKind: "api_key", AuthModes: []string{"api_key"}, Official: true, Pinned: true},
		{Slug: "custom-anthropic", Name: "Custom (Anthropic-compatible)", Dialect: dialectAnthropic, Capabilities: llmCaps(), AuthKind: "api_key", AuthModes: []string{"api_key"}, Official: true, Pinned: true},
		{Slug: "openai", Name: "OpenAI", BaseURL: "https://api.openai.com/v1", Dialect: dialectOpenAI, Capabilities: llmCaps("embeddings", "image", "tts", "stt", "search"), AuthKind: "api_key", AuthModes: []string{"api_key"}, Official: true},
		{Slug: "anthropic", Name: "Anthropic", BaseURL: "https://api.anthropic.com/v1", Dialect: dialectAnthropic, Capabilities: llmCaps(), AuthKind: "api_key", AuthModes: []string{"api_key"}, Official: true},
		{Slug: "openrouter", Name: "OpenRouter", BaseURL: "https://openrouter.ai/api/v1", Dialect: dialectOpenAI, Capabilities: llmCaps("embeddings"), AuthKind: "api_key", AuthModes: []string{"api_key"}, Official: true, Notice: "Free tier: 27+ free models, no credit card, 200 req/day."},
		{Slug: "nvidia", Name: "NVIDIA NIM", BaseURL: "https://integrate.api.nvidia.com/v1", Dialect: dialectOpenAI, Capabilities: llmCaps("tts", "embeddings"), AuthKind: "api_key", AuthModes: []string{"api_key"}, Official: true},
		{Slug: "cline", Name: "Cline", BaseURL: "https://api.cline.bot/api/v1", Dialect: dialectOpenAI, Capabilities: llmCaps(), AuthKind: "api_key", AuthModes: []string{"api_key"}, Official: true},
		{Slug: "cloudflare", Name: "Cloudflare AI", BaseURL: "https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/v1", Dialect: dialectOpenAI, Capabilities: llmCaps("embeddings", "image", "stt", "tts"), AuthKind: "api_key", AuthModes: []string{"api_key"}, Official: true, Notice: "The endpoint embeds your Cloudflare account ID — set the account's Base URL to https://api.cloudflare.com/client/v4/accounts/<account_id>/ai/v1."},

		// Codex is reachable only through OpenAI's "Sign in to official
		// website" connect flow: its subscription tokens serve the ChatGPT
		// backend, not the public API, so the account stays attributed to
		// this separate (hidden) provider instead of the openai tile.
		{Slug: "codex", Name: "OpenAI Codex", BaseURL: "https://chatgpt.com/backend-api/codex/responses", Dialect: dialectOpenAIResponses, Capabilities: llmCaps("image"), AuthKind: "oauth", AuthModes: []string{"oauth"}, Official: false, Hidden: true, Notice: "Uses a ChatGPT/OAuth subscription session not licensed for proxy use. Account may be restricted. Use at your own risk."},
	}
}

// Listed returns the provider specs that appear in the dashboard's provider
// listing — All() minus the hidden ones, which stay routable via Lookup.
func Listed() []dtos.CatalogProvider {
	out := make([]dtos.CatalogProvider, 0)
	for _, p := range All() {
		if !p.Hidden {
			out = append(out, p)
		}
	}
	return out
}

// seedable lists the catalog providers that materialize a custom_providers
// row when one of their accounts is created, seeded from the catalog spec, so
// the dashboard can address the connected provider by uuid against the
// database instead of the "prov-<slug>" catalog identity.
var seedable = map[string]bool{
	"openai":     true,
	"anthropic":  true,
	"openrouter": true,
	"nvidia":     true,
	"cline":      true,
	"cloudflare": true,
}

// Seedable reports whether connecting the catalog provider (creating an
// account for it) persists a custom_providers row seeded from the spec.
func Seedable(slug string) bool {
	return seedable[slug]
}

// Lookup finds one provider spec by slug.
func Lookup(slug string) (dtos.CatalogProvider, bool) {
	for _, p := range All() {
		if p.Slug == slug {
			return p, true
		}
	}
	return dtos.CatalogProvider{}, false
}
