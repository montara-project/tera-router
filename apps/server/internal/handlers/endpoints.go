package handlers

import (
	"tera-router/server/internal/app"
	"tera-router/server/internal/dtos"

	"github.com/gofiber/fiber/v3"
)

type endpointsHandler struct {
	app *app.Application
}

// endpointRoute is one HTTP route an application can call. Provider names the
// upstream API a route speaks, when it speaks one.
type endpointRoute struct {
	Method      string `json:"method"`
	Path        string `json:"path"`
	Description string `json:"description"`
	Provider    string `json:"provider,omitempty"`
}

// endpointGroup clusters routes on the Endpoints page. Auth is true when the
// routes need an API key.
type endpointGroup struct {
	Title  string          `json:"title"`
	Auth   bool            `json:"auth"`
	Routes []endpointRoute `json:"routes"`
}

// endpointCatalog is GET /v1/endpoints: the origin the caller reached the
// router on, and the route reference grouped for display.
type endpointCatalog struct {
	BaseURL string          `json:"base_url"`
	Groups  []endpointGroup `json:"groups"`
}

// apiReference lists the routes the Endpoints page documents. Every key-gated
// path must be a gateway route, and every gateway route must appear here;
// TestAPIReferenceMatchesGateway enforces both.
var apiReference = []endpointGroup{
	{Title: "Text generation", Auth: true, Routes: []endpointRoute{
		{Method: "POST", Path: "/v1/chat/completions", Description: "Chat completions", Provider: "OpenAI"},
		{Method: "POST", Path: "/v1/responses", Description: "Responses API, used by Codex and Responses-native clients", Provider: "OpenAI"},
		{Method: "POST", Path: "/responses", Description: "Responses API at the root path", Provider: "OpenAI"},
		{Method: "POST", Path: "/v1/messages", Description: "Messages API, used by Claude Code", Provider: "Anthropic"},
		{Method: "POST", Path: "/v1/messages/count_tokens", Description: "Count tokens before a turn, answered locally", Provider: "Anthropic"},
	}},
	{Title: "Media and tools", Auth: true, Routes: []endpointRoute{
		{Method: "POST", Path: "/v1/embeddings", Description: "Text embeddings"},
		{Method: "POST", Path: "/v1/images/generations", Description: "Image generation"},
		{Method: "POST", Path: "/v1/audio/speech", Description: "Text to speech"},
		{Method: "POST", Path: "/v1/audio/transcriptions", Description: "Speech to text"},
		{Method: "POST", Path: "/v1/search", Description: "Web search"},
		{Method: "POST", Path: "/v1/web/fetch", Description: "Fetch a web page"},
	}},
	{Title: "Models and usage", Auth: true, Routes: []endpointRoute{
		{Method: "GET", Path: "/v1/models", Description: "Model IDs this key can call"},
	}},
	{Title: "Public", Auth: false, Routes: []endpointRoute{
		{Method: "GET", Path: "/health", Description: "Server health check"},
		{Method: "GET", Path: "/skills/:slug/SKILL.md", Description: "Agent skill document"},
	}},
}

// Catalog serves GET /v1/endpoints. base_url is the origin the request arrived
// on, so the page shows the address the browser is actually using.
func (h *endpointsHandler) Catalog(c fiber.Ctx) error {
	return dtos.OK(c, endpointCatalog{BaseURL: requestBaseURL(c), Groups: apiReference})
}
