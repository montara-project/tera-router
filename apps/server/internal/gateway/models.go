package gateway

import (
	"context"
	"net/http"

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

// handleListModels serves GET /v1/models: the model ids a client may put in
// a chat request. Only model aliases are advertised — the operator-curated
// public surface for coding agents' model pickers. Chains, the auto-combo
// ids, and bare catalog model ids still resolve when a client names them
// explicitly, but they are not discoverable through this listing.
//
// The listing is identity-level: it does not reflect the calling key's model
// allowlist, which the per-request access check enforces anyway.
func (s *Server) handleListModels(c fiber.Ctx) error {
	if _, ok := authedKey(c); !ok {
		return s.fail(c, core.DialectOpenAI, http.StatusUnauthorized, "missing API key")
	}

	ctx, cancel := context.WithTimeout(c.Context(), routingDeadline)
	defer cancel()

	aliases, err := s.app.Repos.Aliases.List(ctx)
	if err != nil {
		s.log.Error("gateway list models: aliases query failed", "error", err)
		return s.fail(c, core.DialectOpenAI, http.StatusInternalServerError, "failed to list models")
	}
	data := make([]modelEntry, 0, len(aliases))
	for _, alias := range aliases {
		// An inactive alias does not resolve, so it must not be advertised.
		if !alias.Active {
			continue
		}
		var created int64
		if !alias.CreatedAt.IsZero() {
			created = alias.CreatedAt.Unix()
		}
		data = append(data, modelEntry{ID: alias.Name, Object: "model", OwnedBy: "alias", Created: created})
	}

	return c.Status(http.StatusOK).JSON(fiber.Map{"object": "list", "data": data})
}
