package handlers

import (
	"tera-router/server/internal/app"
	"tera-router/server/internal/dtos"

	"github.com/gofiber/fiber/v3"
)

type consoleHandler struct {
	app *app.Application
}

// Index returns the console ring buffer, newest last.
func (h *consoleHandler) Index(c fiber.Ctx) error {
	return dtos.List(c, ConsoleList(), dtos.Metadata{})
}

// Clear empties the console feed.
func (h *consoleHandler) Clear(c fiber.Ctx) error {
	ConsoleClear()
	ConsolePush(dtos.LogLevelInfo, "Console cleared", "")
	return dtos.List(c, []dtos.ConsoleEntry{}, dtos.Metadata{})
}

type systemHandler struct {
	app *app.Application
}

// Stats samples host, process, and runtime metrics with the rolling history.
func (h *systemHandler) Stats(c fiber.Ctx) error {
	stats, err := h.app.Services.System.Stats()
	if err != nil {
		return err
	}
	return dtos.OK(c, stats)
}

type mediaHandler struct {
	app *app.Application
}

// Index returns the static media provider catalog (embeddings, TTS, STT,
// image, search, image-to-text).
func (h *mediaHandler) Index(c fiber.Ctx) error {
	providers := []dtos.MediaProvider{
		{ID: "media-openrouter", Name: "OpenRouter", Slug: "openrouter", Capabilities: []string{"embed", "image_to_text"}},
		{ID: "media-nvidia", Name: "NVIDIA NIM", Slug: "nvidia", Capabilities: []string{"tts", "embed"}},
		{ID: "media-gemini", Name: "Gemini", Slug: "gemini", Capabilities: []string{"embed", "image", "search", "tts", "stt", "image_to_text"}},
		{ID: "media-openai", Name: "OpenAI", Slug: "openai", Capabilities: []string{"embed", "tts", "stt", "image", "search"}},
		{ID: "media-mistral", Name: "Mistral", Slug: "mistral", Capabilities: []string{"embed", "image_to_text"}},
		{ID: "media-together", Name: "Together AI", Slug: "together", Capabilities: []string{"embed"}},
		{ID: "media-fireworks", Name: "Fireworks AI", Slug: "fireworks", Capabilities: []string{"embed"}},
		{ID: "media-nebius", Name: "Nebius AI", Slug: "nebius", Capabilities: []string{"embed"}},
		{ID: "media-voyage", Name: "Voyage AI", Slug: "voyage-ai", Capabilities: []string{"embed"}},
		{ID: "media-jina", Name: "Jina AI", Slug: "jina-ai", Capabilities: []string{"embed"}},
	}
	return dtos.OK(c, fiber.Map{"providers": providers})
}
