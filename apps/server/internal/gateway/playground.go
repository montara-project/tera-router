package gateway

import (
	"context"
	"errors"
	"sort"

	"tera-router/server/internal/core"
	"tera-router/server/internal/dtos"
	"tera-router/server/internal/modelcatalog"
	"tera-router/server/internal/models"

	"github.com/gofiber/fiber/v3"
)

// playgroundKey is the identity the dashboard playground speaks to the
// gateway as: no plan, no allowlist, and no key id, so its usage rows are
// metered and budgeted like any other traffic but attributed to no API key.
var playgroundKey = models.APIKey{Name: "playground"}

// PlaygroundChat serves POST /v1/playground/chat for the dashboard (JWT
// auth): an OpenAI chat completion routed exactly like gateway traffic, so a
// provider/model, an alias, or a chain all resolve, fall back, and stream
// the same way they would for a client.
func (s *Server) PlaygroundChat(c fiber.Ctx) error {
	c.Locals(authedKeyLocal, playgroundKey)
	return s.handleChat(c, core.DialectOpenAI)
}

// PlaygroundModels serves GET /v1/playground/models: every model id the
// playground can address — the active catalog models of each provider with a
// usable account (as "provider/model"), then the advertised aliases and
// chains. OwnedBy is the provider slug, "alias", or "chain".
func (s *Server) PlaygroundModels(c fiber.Ctx) error {
	ctx, cancel := context.WithTimeout(c.Context(), routingDeadline)
	defer cancel()

	data, err := s.providerModelEntries(ctx)
	if err != nil {
		return err
	}
	routes, err := s.routeModelEntries(ctx)
	if err != nil {
		return err
	}
	return dtos.OK(c, append(data, routes...))
}

// providerModelEntries lists the active stored-catalog models of providers
// that have a usable account, sorted by provider slug. Providers without a
// stored catalog contribute nothing: there is no list to offer.
func (s *Server) providerModelEntries(ctx context.Context) ([]modelEntry, error) {
	usable, err := s.app.Repos.Accounts.CountUsableByProvider(ctx)
	if err != nil {
		return nil, err
	}
	slugs := make([]string, 0, len(usable))
	for slug, n := range usable {
		if n > 0 {
			slugs = append(slugs, slug)
		}
	}
	sort.Strings(slugs)

	data := make([]modelEntry, 0)
	for _, slug := range slugs {
		cat, err := modelcatalog.Load(ctx, s.app.Repos.Settings, slug)
		if errors.Is(err, modelcatalog.ErrNoCatalog) {
			continue
		}
		if err != nil {
			return nil, err
		}
		for _, m := range cat.Models {
			if m.State == modelcatalog.StateActive {
				data = append(data, modelEntry{ID: slug + "/" + m.ID, Object: "model", OwnedBy: slug})
			}
		}
	}
	return data, nil
}
