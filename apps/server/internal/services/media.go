package services

// MediaProvider is one media-capable provider entry, ported from IDRouter's
// connectors media catalog.
type MediaProvider struct {
	ID           string   `json:"id"`
	Name         string   `json:"name"`
	Slug         string   `json:"slug"`
	Capabilities []string `json:"capabilities"`
}

type MediaService struct{}

// List returns the static media provider catalog (embeddings, TTS, STT,
// image, search, image-to-text).
func (s *MediaService) List() []MediaProvider {
	return []MediaProvider{
		{ID: "media-openrouter", Name: "OpenRouter", Slug: "openrouter", Capabilities: []string{"embed", "image_to_text"}},
		{ID: "media-nvidia", Name: "NVIDIA NIM", Slug: "nvidia", Capabilities: []string{"tts", "embed"}},
		{ID: "media-vllm", Name: "vLLM", Slug: "vllm", Capabilities: []string{"embed"}},
		{ID: "media-gemini", Name: "Gemini", Slug: "gemini", Capabilities: []string{"embed", "image", "search", "tts", "stt", "image_to_text"}},
		{ID: "media-github", Name: "GitHub Copilot", Slug: "github", Capabilities: []string{"embed"}},
		{ID: "media-openai", Name: "OpenAI", Slug: "openai", Capabilities: []string{"embed", "tts", "stt", "image", "search"}},
		{ID: "media-mistral", Name: "Mistral", Slug: "mistral", Capabilities: []string{"embed", "image_to_text"}},
		{ID: "media-together", Name: "Together AI", Slug: "together", Capabilities: []string{"embed"}},
		{ID: "media-fireworks", Name: "Fireworks AI", Slug: "fireworks", Capabilities: []string{"embed"}},
		{ID: "media-nebius", Name: "Nebius AI", Slug: "nebius", Capabilities: []string{"embed"}},
		{ID: "media-venice", Name: "Venice AI", Slug: "venice", Capabilities: []string{"embed", "image"}},
		{ID: "media-voyage", Name: "Voyage AI", Slug: "voyage-ai", Capabilities: []string{"embed"}},
		{ID: "media-jina", Name: "Jina AI", Slug: "jina-ai", Capabilities: []string{"embed"}},
	}
}
