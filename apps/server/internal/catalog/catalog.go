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
		{Slug: "openai", Name: "OpenAI", BaseURL: "https://api.openai.com/v1", Dialect: dialectOpenAI, Capabilities: llmCaps("embeddings", "image", "tts", "stt"), AuthKind: "api_key", AuthModes: []string{"api_key"}, Official: true},
		{Slug: "anthropic", Name: "Anthropic", BaseURL: "https://api.anthropic.com/v1", Dialect: dialectAnthropic, Capabilities: llmCaps(), AuthKind: "api_key", AuthModes: []string{"api_key"}, Official: true},
		{Slug: "openrouter", Name: "OpenRouter", BaseURL: "https://openrouter.ai/api/v1", Dialect: dialectOpenAI, Capabilities: llmCaps("embeddings"), AuthKind: "api_key", AuthModes: []string{"api_key"}, Official: true, Notice: "Free tier: 27+ free models, no credit card, 200 req/day."},
		{Slug: "nvidia", Name: "NVIDIA NIM", BaseURL: "https://integrate.api.nvidia.com/v1", Dialect: dialectOpenAI, Capabilities: llmCaps("embeddings"), AuthKind: "api_key", AuthModes: []string{"api_key"}, Official: true},
		{Slug: "gemini", Name: "Gemini", BaseURL: "https://generativelanguage.googleapis.com/v1beta/openai", Dialect: dialectOpenAI, Capabilities: llmCaps("embeddings", "image"), AuthKind: "api_key", AuthModes: []string{"api_key"}, Official: true},
		{Slug: "mistral", Name: "Mistral AI", BaseURL: "https://api.mistral.ai/v1", Dialect: dialectOpenAI, Capabilities: llmCaps("embeddings"), AuthKind: "api_key", AuthModes: []string{"api_key"}, Official: true},
		{Slug: "together", Name: "Together AI", BaseURL: "https://api.together.xyz/v1", Dialect: dialectOpenAI, Capabilities: llmCaps("embeddings", "image"), AuthKind: "api_key", AuthModes: []string{"api_key"}, Official: true},
		{Slug: "fireworks", Name: "Fireworks AI", BaseURL: "https://api.fireworks.ai/inference/v1", Dialect: dialectOpenAI, Capabilities: llmCaps("embeddings"), AuthKind: "api_key", AuthModes: []string{"api_key"}, Official: true},
		{Slug: "nebius", Name: "Nebius Token Factory", BaseURL: "https://api.tokenfactory.nebius.com/v1", Dialect: dialectOpenAI, Capabilities: llmCaps("embeddings"), AuthKind: "api_key", AuthModes: []string{"api_key"}, Official: true},
		{Slug: "groq", Name: "Groq", BaseURL: "https://api.groq.com/openai/v1", Dialect: dialectOpenAI, Capabilities: llmCaps("stt"), AuthKind: "api_key", AuthModes: []string{"api_key"}, Official: true},
		{Slug: "cline", Name: "Cline", BaseURL: "https://api.cline.bot/api/v1", Dialect: dialectOpenAI, Capabilities: llmCaps(), AuthKind: "api_key", AuthModes: []string{"api_key"}, Official: true},
		{Slug: "cloudflare", Name: "Cloudflare AI", BaseURL: "https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/v1", Dialect: dialectOpenAI, Capabilities: llmCaps("embeddings"), AuthKind: "api_key", AuthModes: []string{"api_key"}, Official: true, Notice: "The endpoint embeds your Cloudflare account ID — set the account's Base URL to https://api.cloudflare.com/client/v4/accounts/<account_id>/ai/v1."},
		// Web search/fetch providers: no chat dialect, served by the gateway's
		// /v1/search and /v1/web/fetch (connectors/web.go).
		{Slug: "exa", Name: "Exa", BaseURL: "https://api.exa.ai", Capabilities: []string{"search", "fetch"}, AuthKind: "api_key", AuthModes: []string{"api_key"}, Official: true},
		{Slug: "tavily", Name: "Tavily", BaseURL: "https://api.tavily.com", Capabilities: []string{"search", "fetch"}, AuthKind: "api_key", AuthModes: []string{"api_key"}, Official: true},
		{Slug: "firecrawl", Name: "Firecrawl", BaseURL: "https://api.firecrawl.dev/v2", Capabilities: []string{"search", "fetch"}, AuthKind: "api_key", AuthModes: []string{"api_key"}, Official: true},
		// Embedding-only provider with an OpenAI-shaped /embeddings API.
		{Slug: "voyage-ai", Name: "Voyage AI", BaseURL: "https://api.voyageai.com/v1", Capabilities: []string{"embeddings"}, AuthKind: "api_key", AuthModes: []string{"api_key"}, Official: true},
		{Slug: "jina-ai", Name: "Jina AI", BaseURL: "https://api.jina.ai/v1", Capabilities: []string{"embeddings", "search", "fetch"}, AuthKind: "api_key", AuthModes: []string{"api_key"}, Official: true},
		{Slug: "brave", Name: "Brave Search", BaseURL: "https://api.search.brave.com/res/v1", Capabilities: []string{"search"}, AuthKind: "api_key", AuthModes: []string{"api_key"}, Official: true},
		{Slug: "serper", Name: "Serper", BaseURL: "https://google.serper.dev", Capabilities: []string{"search"}, AuthKind: "api_key", AuthModes: []string{"api_key"}, Official: true},
		// Voice providers: no chat dialect, served by the gateway's
		// /v1/audio/speech and /v1/audio/transcriptions (connectors/audio.go).
		{Slug: "elevenlabs", Name: "ElevenLabs", BaseURL: "https://api.elevenlabs.io/v1", Capabilities: []string{"tts", "stt"}, AuthKind: "api_key", AuthModes: []string{"api_key"}, Official: true},
		{Slug: "deepgram", Name: "Deepgram", BaseURL: "https://api.deepgram.com/v1", Capabilities: []string{"tts", "stt"}, AuthKind: "api_key", AuthModes: []string{"api_key"}, Official: true},
		{Slug: "muse", Name: "Meta Muse", BaseURL: "https://api.meta.ai/v1", Dialect: dialectOpenAI, Capabilities: llmCaps("image"), AuthKind: "api_key", AuthModes: []string{"api_key"}, Official: true},

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
	"groq":       true,
	"gemini":     true,
	"mistral":    true,
	"together":   true,
	"fireworks":  true,
	"nebius":     true,
	"cline":      true,
	"cloudflare": true,
	"muse":       true,
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
