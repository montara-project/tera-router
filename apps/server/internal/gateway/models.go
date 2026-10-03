package gateway

import (
	"context"
	"net/http"
	"strings"
	"time"

	"tera-router/server/internal/autocombo"
	"tera-router/server/internal/core"
	"tera-router/server/internal/models"

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
// a chat request. Entries are emitted in resolution precedence — active
// aliases, then enabled chains — and each bare name appears once, so a listed
// id never resolves to a different kind of route than its owned_by claims.
// Bare catalog model ids and the auto-combo ids still resolve when a client
// names them explicitly, but they are not discoverable through this listing.
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

	// seen holds the advertised bare names. resolveTargets picks the first
	// matching form for a name and the emission order below mirrors that
	// precedence, so a skipped duplicate would have resolved to the earlier
	// entry, not to it.
	seen := make(map[string]struct{}, len(aliases))
	data := make([]modelEntry, 0, len(aliases))
	for _, alias := range aliases {
		// An inactive alias does not resolve, so it must not be advertised.
		if !alias.Active {
			continue
		}
		if !claimName(seen, alias.Name) {
			continue
		}
		data = append(data, modelEntry{
			ID:      alias.Name,
			Object:  "model",
			OwnedBy: "alias",
			Created: createdUnix(alias.CreatedAt),
		})
	}

	chains, err := s.app.Repos.Chains.List(ctx)
	if err != nil {
		s.log.Error("gateway list models: chains query failed", "error", err)
		return s.fail(c, core.DialectOpenAI, http.StatusInternalServerError, "failed to list models")
	}
	for _, chain := range chains {
		// A disabled or targetless chain is a bad model in chainResult, and a
		// shadowed name never reaches it as a bare request, so neither is
		// advertised.
		if !chain.Enabled || !chainHasTarget(chain) || !chainNameResolvable(chain.Name) {
			continue
		}
		if !claimName(seen, chain.Name) {
			continue
		}
		data = append(data, modelEntry{
			ID:      chain.Name,
			Object:  "model",
			OwnedBy: "chain",
			Created: createdUnix(chain.CreatedAt),
		})
	}

	return c.Status(http.StatusOK).JSON(fiber.Map{"object": "list", "data": data})
}

// claimName reserves name in seen, reporting false when a higher-precedence
// entry already claimed it.
func claimName(seen map[string]struct{}, name string) bool {
	if _, dup := seen[name]; dup {
		return false
	}
	seen[name] = struct{}{}
	return true
}

// chainNameResolvable reports whether a chain's bare name can reach
// chainResult in resolveTargets: an exact alias, the auto-combo prefix, and
// the provider/model split are matched first — and the provider/model form
// rejects an unknown provider instead of falling through — so a name those
// forms capture is only reachable written with an explicit "chain:" prefix.
func chainNameResolvable(name string) bool {
	if _, combo := autocombo.ParsePrefix(name); combo {
		return false
	}
	return !strings.Contains(name, "/") && !strings.HasPrefix(name, "chain:")
}

// chainHasTarget mirrors chainResult's target construction: usable steps,
// plus the configured fallback as the last-resort target.
func chainHasTarget(chain models.Chain) bool {
	for _, step := range chain.Steps {
		if step.Provider != "" && step.Model != "" {
			return true
		}
	}
	return chain.FallbackProvider != "" && chain.FallbackModel != ""
}

// createdUnix renders a row timestamp for the listing; zero stays omitted.
func createdUnix(t time.Time) int64 {
	if t.IsZero() {
		return 0
	}
	return t.Unix()
}
