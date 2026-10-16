package gateway

import (
	"cmp"
	"context"
	"encoding/json"
	"net/http"
	"slices"

	"tera-router/server/internal/catalog"
	"tera-router/server/internal/connectors"
	"tera-router/server/internal/core"

	"github.com/gofiber/fiber/v3"
)

// handleImages serves POST /v1/images/generations in OpenAI's shape.
func (s *Server) handleImages(c fiber.Ctx) error {
	return s.serveOpenAIMedia(c, "image generation", connectors.ImageCapability, "images/generations")
}

// handleEmbeddings serves POST /v1/embeddings in OpenAI's shape.
func (s *Server) handleEmbeddings(c fiber.Ctx) error {
	return s.serveOpenAIMedia(c, "embeddings", connectors.EmbeddingCapability, "embeddings")
}

// serveOpenAIMedia relays an OpenAI-shaped request to the first provider that
// can serve it, rewriting only the model, and relays the response unchanged.
func (s *Server) serveOpenAIMedia(c fiber.Ctx, what, capability, path string) error {
	var body map[string]any
	if err := json.Unmarshal(c.Body(), &body); err != nil {
		return writeError(c, http.StatusBadRequest, "invalid request: body must be a JSON object")
	}
	model, _ := body["model"].(string)

	return s.serveDirect(c, what, s.capabilityTargets(model, openAIMediaSupport(capability)),
		func(ctx context.Context, at webAttempt) (func() error, core.Usage, error) {
			body["model"] = at.Target.Model
			resp, err := connectors.OpenAIPost(ctx, at.Target.Provider, at.BaseURL, at.Creds, path, body)
			if err != nil {
				return nil, core.Usage{}, err
			}
			return func() error {
				c.Set(fiber.HeaderContentType, cmp.Or(resp.ContentType, fiber.MIMEApplicationJSON))
				return c.Status(http.StatusOK).Send(resp.Body)
			}, reportedUsage(resp.Body), nil
		})
}

// openAIMediaSupport admits catalog providers that list the capability and
// either speak the OpenAI dialect or have no chat dialect at all (Jina AI,
// Voyage AI: OpenAI-shaped embeddings only), plus any OpenAI-compatible
// custom provider.
func openAIMediaSupport(capability string) providerSupport {
	return func(slug string, spec providerSpec, custom bool) bool {
		if custom {
			return spec.Dialect == core.DialectOpenAI
		}
		cp, _ := catalog.Lookup(slug)
		return slices.Contains(cp.Capabilities, capability) &&
			(spec.Dialect == core.DialectOpenAI || spec.Dialect == "")
	}
}

// reportedUsage reads the token usage an OpenAI-shaped response carries:
// prompt_tokens for embeddings, input/output tokens for gpt-image models.
func reportedUsage(body []byte) core.Usage {
	var r struct {
		Usage struct {
			PromptTokens int `json:"prompt_tokens"`
			InputTokens  int `json:"input_tokens"`
			OutputTokens int `json:"output_tokens"`
		} `json:"usage"`
	}
	_ = json.Unmarshal(body, &r)
	u := core.Usage{PromptTokens: r.Usage.PromptTokens + r.Usage.InputTokens, CompletionTokens: r.Usage.OutputTokens}
	u.TotalTokens = u.PromptTokens + u.CompletionTokens
	return u
}
