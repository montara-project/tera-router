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
		// {Slug: "claude", Name: "Claude Code", BaseURL: "https://api.anthropic.com/v1", Dialect: dialectAnthropic, Capabilities: llmCaps(), AuthKind: "oauth", AuthModes: []string{"oauth"}, Official: false, Notice: "Uses a subscription/OAuth session not licensed for proxy use. Account may be restricted. Use at your own risk."},
		// {Slug: "gemini", Name: "Gemini", BaseURL: "https://generativelanguage.googleapis.com/v1beta", Capabilities: llmCaps("embeddings", "image", "stt", "tts", "search"), AuthKind: "api_key", AuthModes: []string{"api_key"}, Official: true},
		// {Slug: "vertex", Name: "Vertex AI", BaseURL: "https://aiplatform.googleapis.com", Capabilities: llmCaps(), AuthKind: "oauth", AuthModes: []string{"oauth"}, Official: true},
		// {Slug: "codex", Name: "OpenAI Codex", BaseURL: "https://chatgpt.com/backend-api/codex/responses", Dialect: dialectOpenAIResponses, Capabilities: llmCaps("image"), AuthKind: "oauth", AuthModes: []string{"oauth"}, Official: false, Notice: "Uses a subscription/OAuth session not licensed for proxy use. Account may be restricted. Use at your own risk."},
		// {Slug: "deepseek", Name: "DeepSeek", BaseURL: "https://api.deepseek.com", Dialect: dialectOpenAI, Capabilities: llmCaps(), AuthKind: "api_key", AuthModes: []string{"api_key"}, Official: true},
		// {Slug: "xai", Name: "xAI (Grok)", BaseURL: "https://api.x.ai/v1", Dialect: dialectOpenAI, Capabilities: llmCaps("search", "image"), AuthKind: "api_key", AuthModes: []string{"api_key", "oauth"}, Official: true},
		// {Slug: "glm", Name: "GLM Coding", BaseURL: "https://api.z.ai/api/anthropic/v1", Dialect: dialectAnthropic, Capabilities: llmCaps(), AuthKind: "api_key", AuthModes: []string{"api_key"}, Official: true},
		// {Slug: "glm-cn", Name: "GLM (China)", BaseURL: "https://open.bigmodel.cn/api/coding/paas/v4", Dialect: dialectOpenAI, Capabilities: llmCaps(), AuthKind: "api_key", AuthModes: []string{"api_key"}, Official: true},
		// {Slug: "kimi", Name: "Kimi", BaseURL: "https://api.kimi.com/coding/v1", Dialect: dialectAnthropic, Capabilities: llmCaps("search"), AuthKind: "api_key", AuthModes: []string{"api_key"}, Official: true},
		// {Slug: "minimax", Name: "MiniMax Coding", BaseURL: "https://api.minimax.io/anthropic/v1", Dialect: dialectAnthropic, Capabilities: llmCaps("image", "search", "tts"), AuthKind: "api_key", AuthModes: []string{"api_key"}, Official: true},
		// {Slug: "mistral", Name: "Mistral", BaseURL: "https://api.mistral.ai/v1", Dialect: dialectOpenAI, Capabilities: llmCaps("embeddings"), AuthKind: "api_key", AuthModes: []string{"api_key"}, Official: true},
		// {Slug: "groq", Name: "Groq", BaseURL: "https://api.groq.com/openai/v1", Dialect: dialectOpenAI, Capabilities: llmCaps("stt"), AuthKind: "api_key", AuthModes: []string{"api_key"}, Official: true},
		// {Slug: "cohere", Name: "Cohere", BaseURL: "https://api.cohere.com/compatibility/v1", Dialect: dialectOpenAI, Capabilities: llmCaps("embeddings", "search"), AuthKind: "api_key", AuthModes: []string{"api_key"}, Official: true},
		// {Slug: "perplexity", Name: "Perplexity", BaseURL: "https://api.perplexity.ai", Dialect: dialectOpenAI, Capabilities: llmCaps("search"), AuthKind: "api_key", AuthModes: []string{"api_key"}, Official: true},
		// Ollama (cloud and local) serves an OpenAI-compatible endpoint under
		// /v1 (chat completions, models) beside its native /api surface, so
		// the gateway speaks the plain OpenAI dialect against it. The native
		// /api/tags model list is still what sync and probing use.
		// {Slug: "ollama", Name: "Ollama Cloud", BaseURL: "https://ollama.com/v1", Dialect: dialectOpenAI, Capabilities: llmCaps(), AuthKind: "api_key", AuthModes: []string{"api_key"}, Official: true},
		// {Slug: "ollama-local", Name: "Ollama Local", BaseURL: "http://localhost:11434/v1", Dialect: dialectOpenAI, Capabilities: llmCaps(), AuthKind: "none", AuthModes: []string{"none"}, Official: true},
		// {Slug: "vllm", Name: "vLLM", BaseURL: "http://localhost:8000/v1", Dialect: dialectOpenAI, Capabilities: llmCaps("embeddings"), AuthKind: "none", AuthModes: []string{"none", "api_key"}, Official: true, Notice: "Self-hosted vLLM OpenAI-compatible server. Provide an API key only if you started vLLM with --api-key."},
		// {Slug: "azure", Name: "Azure OpenAI", Dialect: dialectOpenAI, Capabilities: llmCaps(), AuthKind: "api_key", AuthModes: []string{"api_key"}, Official: true},
		// {Slug: "github", Name: "GitHub Copilot", BaseURL: "https://api.githubcopilot.com", Capabilities: llmCaps("embeddings"), AuthKind: "oauth", AuthModes: []string{"oauth"}, Official: false},
		// {Slug: "cursor", Name: "Cursor IDE", BaseURL: "https://api2.cursor.sh", Capabilities: llmCaps(), AuthKind: "oauth", AuthModes: []string{"oauth"}, Official: false},
		// {Slug: "kiro", Name: "Kiro AI", BaseURL: "https://codewhisperer.us-east-1.amazonaws.com/generateAssistantResponse", Capabilities: llmCaps(), AuthKind: "oauth", AuthModes: []string{"oauth"}, Official: false},
		// {Slug: "qoder", Name: "Qoder", BaseURL: "https://api3.qoder.sh/algo/api/v2/service/pro/sse/agent_chat_generation", Capabilities: llmCaps(), AuthKind: "oauth", AuthModes: []string{"oauth"}, Official: false},
		// {Slug: "kilocode", Name: "Kilo Code", BaseURL: "https://api.kilo.ai/api/openrouter", Dialect: dialectOpenAI, Capabilities: llmCaps(), AuthKind: "oauth", AuthModes: []string{"oauth"}, Official: false},
	}
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
