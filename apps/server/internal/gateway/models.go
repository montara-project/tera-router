package gateway

import (
	"context"
	"net/http"

	"tera-router/server/internal/autocombo"
	"tera-router/server/internal/core"

	"github.com/gofiber/fiber/v3"
)

// modelEntry is one row of the GET /v1/models listing, in the OpenAI shape.
type modelEntry struct {
	ID      string `json:"id"`
	Object  string `json:"object"`
	OwnedBy string `json:"owned_by"`
	Created int64  `json:"created,omitempty"`
}

// handleListModels serves GET /v1/models: every model id a client can put in
// a chat request. Chains are advertised as "combo" models — matching the
// upstream convention that a combo chains multiple providers with
// auto-fallback and is callable by its bare name — alongside the auto-combo
// ids ("auto", "auto/<variant>"), so coding agents can discover and select
// them from their model pickers.
//
// The listing is identity-level: it does not reflect the calling key's model
// allowlist, which the per-request access check enforces anyway.
func (s *Server) handleListModels(c fiber.Ctx) error {
	if _, ok := authedKey(c); !ok {
		return s.fail(c, core.DialectOpenAI, http.StatusUnauthorized, "missing API key")
	}

	ctx, cancel := context.WithTimeout(c.Context(), routingDeadline)
	defer cancel()

	data := make([]modelEntry, 0, 16)
	chains, err := s.app.Repos.Chains.List(ctx)
	if err != nil {
		s.log.Error("gateway list models: chains query failed", "error", err)
		return s.fail(c, core.DialectOpenAI, http.StatusInternalServerError, "failed to list models")
	}
	for _, chain := range chains {
		if !chain.Enabled {
			continue
		}
		var created int64
		if !chain.CreatedAt.IsZero() {
			created = chain.CreatedAt.Unix()
		}
		data = append(data, modelEntry{ID: chain.Name, Object: "model", OwnedBy: "combo", Created: created})
	}
	for _, id := range autocombo.ListedModels() {
		data = append(data, modelEntry{ID: id, Object: "model", OwnedBy: "combo"})
	}

	return c.Status(http.StatusOK).JSON(fiber.Map{"object": "list", "data": data})
}
