package services

// CatalogProvider is a built-in provider spec, ported (condensed) from
// IDRouter's connectors catalog: the subset of metadata the dashboard needs
// to render the providers page and validate credentials.
type CatalogProvider struct {
	// Slug is the stable identifier used by accounts and the web UI.
	Slug string `json:"slug"`
	// Name is the human-readable display name.
	Name string `json:"name"`
	// Capabilities lists the service kinds this provider serves
	// (chat, embeddings, image, tts, stt, search).
	Capabilities []string `json:"capabilities"`
	// BaseURL is the default upstream endpoint for API-key providers.
	BaseURL string `json:"base_url,omitempty"`
	// AuthKind is the default authentication mechanism
	// (api_key, oauth, none).
	AuthKind string `json:"auth_kind"`
	// AuthModes lists every supported mechanism.
	AuthModes []string `json:"auth_modes"`
	// Official marks first-party providers; subscription/OAuth-session
	// providers are false and carry usage risk.
	Official bool `json:"official"`
	// Pinned providers render at the top of the listing.
	Pinned bool `json:"pinned"`
	// Notice is an optional human-readable usage note.
	Notice string `json:"notice,omitempty"`
}

func llmCaps(extra ...string) []string {
	return append([]string{"chat"}, extra...)
}

// Catalog returns the built-in provider specs.
func Catalog() []CatalogProvider {
	return []CatalogProvider{
		{Slug: "custom-openai", Name: "Custom (OpenAI-compatible)", Capabilities: llmCaps("embeddings", "image", "tts", "stt"), AuthKind: "api_key", AuthModes: []string{"api_key"}, Official: true, Pinned: true},
		{Slug: "custom-anthropic", Name: "Custom (Anthropic-compatible)", Capabilities: llmCaps(), AuthKind: "api_key", AuthModes: []string{"api_key"}, Official: true, Pinned: true},
		{Slug: "openai", Name: "OpenAI", BaseURL: "https://api.openai.com/v1", Capabilities: llmCaps("embeddings", "image", "tts", "stt", "search"), AuthKind: "api_key", AuthModes: []string{"api_key"}, Official: true},
		{Slug: "anthropic", Name: "Anthropic", BaseURL: "https://api.anthropic.com/v1", Capabilities: llmCaps(), AuthKind: "api_key", AuthModes: []string{"api_key"}, Official: true},
		{Slug: "claude", Name: "Claude Code", BaseURL: "https://api.anthropic.com/v1", Capabilities: llmCaps(), AuthKind: "oauth", AuthModes: []string{"oauth"}, Official: false, Notice: "Uses a subscription/OAuth session not licensed for proxy use. Account may be restricted. Use at your own risk."},
		{Slug: "gemini", Name: "Gemini", BaseURL: "https://generativelanguage.googleapis.com/v1beta", Capabilities: llmCaps("embeddings", "image", "stt", "tts", "search"), AuthKind: "api_key", AuthModes: []string{"api_key"}, Official: true},
		{Slug: "vertex", Name: "Vertex AI", BaseURL: "https://aiplatform.googleapis.com", Capabilities: llmCaps(), AuthKind: "oauth", AuthModes: []string{"oauth"}, Official: true},
		{Slug: "codex", Name: "OpenAI Codex", BaseURL: "https://chatgpt.com/backend-api/codex/responses", Capabilities: llmCaps("image"), AuthKind: "oauth", AuthModes: []string{"oauth"}, Official: false, Notice: "Uses a subscription/OAuth session not licensed for proxy use. Account may be restricted. Use at your own risk."},
		{Slug: "deepseek", Name: "DeepSeek", BaseURL: "https://api.deepseek.com", Capabilities: llmCaps(), AuthKind: "api_key", AuthModes: []string{"api_key"}, Official: true},
		{Slug: "xai", Name: "xAI (Grok)", BaseURL: "https://api.x.ai/v1", Capabilities: llmCaps("search", "image"), AuthKind: "api_key", AuthModes: []string{"api_key", "oauth"}, Official: true},
		{Slug: "glm", Name: "GLM Coding", BaseURL: "https://api.z.ai/api/anthropic/v1", Capabilities: llmCaps(), AuthKind: "api_key", AuthModes: []string{"api_key"}, Official: true},
		{Slug: "glm-cn", Name: "GLM (China)", BaseURL: "https://open.bigmodel.cn/api/coding/paas/v4", Capabilities: llmCaps(), AuthKind: "api_key", AuthModes: []string{"api_key"}, Official: true},
		{Slug: "kimi", Name: "Kimi", BaseURL: "https://api.kimi.com/coding/v1", Capabilities: llmCaps("search"), AuthKind: "api_key", AuthModes: []string{"api_key"}, Official: true},
		{Slug: "minimax", Name: "MiniMax Coding", BaseURL: "https://api.minimax.io/anthropic/v1", Capabilities: llmCaps("image", "search", "tts"), AuthKind: "api_key", AuthModes: []string{"api_key"}, Official: true},
		{Slug: "mistral", Name: "Mistral", BaseURL: "https://api.mistral.ai/v1", Capabilities: llmCaps("embeddings"), AuthKind: "api_key", AuthModes: []string{"api_key"}, Official: true},
		{Slug: "groq", Name: "Groq", BaseURL: "https://api.groq.com/openai/v1", Capabilities: llmCaps("stt"), AuthKind: "api_key", AuthModes: []string{"api_key"}, Official: true},
		{Slug: "cohere", Name: "Cohere", BaseURL: "https://api.cohere.com/compatibility/v1", Capabilities: llmCaps("embeddings", "search"), AuthKind: "api_key", AuthModes: []string{"api_key"}, Official: true},
		{Slug: "perplexity", Name: "Perplexity", BaseURL: "https://api.perplexity.ai", Capabilities: llmCaps("search"), AuthKind: "api_key", AuthModes: []string{"api_key"}, Official: true},
		{Slug: "openrouter", Name: "OpenRouter", BaseURL: "https://openrouter.ai/api/v1", Capabilities: llmCaps("embeddings"), AuthKind: "api_key", AuthModes: []string{"api_key"}, Official: true, Notice: "Free tier: 27+ free models, no credit card, 200 req/day."},
		{Slug: "nvidia", Name: "NVIDIA NIM", BaseURL: "https://integrate.api.nvidia.com/v1", Capabilities: llmCaps("tts", "embeddings"), AuthKind: "api_key", AuthModes: []string{"api_key"}, Official: true},
		{Slug: "ollama", Name: "Ollama Cloud", BaseURL: "https://ollama.com", Capabilities: llmCaps(), AuthKind: "api_key", AuthModes: []string{"api_key"}, Official: true},
		{Slug: "ollama-local", Name: "Ollama Local", BaseURL: "http://localhost:11434", Capabilities: llmCaps(), AuthKind: "none", AuthModes: []string{"none"}, Official: true},
		{Slug: "vllm", Name: "vLLM", BaseURL: "http://localhost:8000/v1", Capabilities: llmCaps("embeddings"), AuthKind: "none", AuthModes: []string{"none", "api_key"}, Official: true, Notice: "Self-hosted vLLM OpenAI-compatible server. Provide an API key only if you started vLLM with --api-key."},
		{Slug: "azure", Name: "Azure OpenAI", Capabilities: llmCaps(), AuthKind: "api_key", AuthModes: []string{"api_key"}, Official: true},
		{Slug: "github", Name: "GitHub Copilot", BaseURL: "https://api.githubcopilot.com", Capabilities: llmCaps("embeddings"), AuthKind: "oauth", AuthModes: []string{"oauth"}, Official: false},
		{Slug: "cursor", Name: "Cursor IDE", BaseURL: "https://api2.cursor.sh", Capabilities: llmCaps(), AuthKind: "oauth", AuthModes: []string{"oauth"}, Official: false},
		{Slug: "kiro", Name: "Kiro AI", BaseURL: "https://codewhisperer.us-east-1.amazonaws.com/generateAssistantResponse", Capabilities: llmCaps(), AuthKind: "oauth", AuthModes: []string{"oauth"}, Official: false},
		{Slug: "qoder", Name: "Qoder", BaseURL: "https://api3.qoder.sh/algo/api/v2/service/pro/sse/agent_chat_generation", Capabilities: llmCaps(), AuthKind: "oauth", AuthModes: []string{"oauth"}, Official: false},
		{Slug: "kilocode", Name: "Kilo Code", BaseURL: "https://api.kilo.ai/api/openrouter", Capabilities: llmCaps(), AuthKind: "oauth", AuthModes: []string{"oauth"}, Official: false},
		{Slug: "cline", Name: "Cline", BaseURL: "https://api.cline.bot/api/v1", Capabilities: llmCaps(), AuthKind: "api_key", AuthModes: []string{"api_key"}, Official: true},
	}
}

// CatalogLookup finds one provider spec by slug.
func CatalogLookup(slug string) (CatalogProvider, bool) {
	for _, p := range Catalog() {
		if p.Slug == slug {
			return p, true
		}
	}
	return CatalogProvider{}, false
}
