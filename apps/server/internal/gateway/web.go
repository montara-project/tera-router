package gateway

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"tera-router/server/internal/catalog"
	"tera-router/server/internal/connectors"
	"tera-router/server/internal/core"

	"github.com/gofiber/fiber/v3"
)

const (
	// defaultWebResults and maxWebResults bound a search's result count.
	defaultWebResults = 5
	maxWebResults     = 20
)

// webAttempt is one provider account a web request may be served by.
type webAttempt struct {
	attempt
	BaseURL string
}

// handleWebSearch serves POST /v1/search:
// {"query": "...", "max_results": 5, "provider": "exa"} -> normalized results.
func (s *Server) handleWebSearch(c fiber.Ctx) error {
	var req struct {
		Query      string `json:"query"`
		MaxResults int    `json:"max_results"`
		Provider   string `json:"provider"`
	}
	if err := json.Unmarshal(c.Body(), &req); err != nil || strings.TrimSpace(req.Query) == "" {
		return writeError(c, http.StatusBadRequest, "invalid request: query is required")
	}
	limit := req.MaxResults
	if limit <= 0 {
		limit = defaultWebResults
	}
	limit = min(limit, maxWebResults)

	return s.serveWeb(c, connectors.WebSearchCapability, req.Provider, func(ctx context.Context, at webAttempt) (fiber.Map, error) {
		results, err := connectors.WebSearch(ctx, at.Target.Provider, at.BaseURL, at.Creds, req.Query, limit)
		return fiber.Map{"query": req.Query, "results": results}, err
	})
}

// handleWebFetch serves POST /v1/web/fetch:
// {"url": "https://...", "provider": "jina-ai"} -> the page as markdown/text.
func (s *Server) handleWebFetch(c fiber.Ctx) error {
	var req struct {
		URL      string `json:"url"`
		Provider string `json:"provider"`
	}
	if err := json.Unmarshal(c.Body(), &req); err != nil ||
		!(strings.HasPrefix(req.URL, "http://") || strings.HasPrefix(req.URL, "https://")) {
		return writeError(c, http.StatusBadRequest, "invalid request: url must be an absolute http(s) URL")
	}

	return s.serveWeb(c, connectors.WebFetchCapability, req.Provider, func(ctx context.Context, at webAttempt) (fiber.Map, error) {
		page, err := connectors.WebFetch(ctx, at.Target.Provider, at.BaseURL, at.Creds, req.URL)
		return fiber.Map{"url": page.URL, "title": page.Title, "content": page.Content}, err
	})
}

// serveWeb runs a web capability over every connected provider that serves
// it — or only the one the client named — trying accounts in catalog then
// priority order and falling back on failure, with the same key access,
// budget, cooldown, and metering rules as chat.
func (s *Server) serveWeb(c fiber.Ctx, capability, provider string, run func(context.Context, webAttempt) (fiber.Map, error)) error {
	release, ok := s.acquire()
	if !ok {
		return writeError(c, http.StatusServiceUnavailable, "server is at capacity, please retry shortly")
	}
	defer release()

	key, ok := authedKey(c)
	if !ok {
		return writeError(c, http.StatusUnauthorized, "missing API key")
	}
	meta := metaFrom(c, key, core.DialectOpenAI)

	if provider != "" && !connectors.SupportsWeb(provider, capability) {
		return writeError(c, http.StatusBadRequest, "provider "+provider+" does not support web "+capability)
	}

	routeCtx, routeCancel := context.WithTimeout(c.Context(), routingDeadline)
	defer routeCancel()

	// Each web provider is a target whose model is the capability, so key and
	// plan allowlists grant it as "exa/search", "exa/*", or "search".
	var targets []target
	for _, spec := range catalog.All() {
		if connectors.SupportsWeb(spec.Slug, capability) && (provider == "" || provider == spec.Slug) {
			targets = append(targets, target{Provider: spec.Slug, Model: capability})
		}
	}

	plan, err := s.planForKey(routeCtx, key)
	if err != nil {
		s.log.Error("gateway load plan failed", "key", meta.KeyName, "error", err)
		return writeError(c, http.StatusInternalServerError, "model access check failed")
	}
	if targets, _ = narrowByAllowlist(key, targets, "", plan); len(targets) == 0 {
		return writeError(c, http.StatusForbidden, "access denied: this API key is not permitted to use web "+capability)
	}
	if err := s.checkBudgets(routeCtx, key, plan); err != nil {
		pe := core.AsProviderError(err)
		if pe.Kind == core.ErrBudgetBlocked {
			return writeError(c, statusForError(pe), pe.Message)
		}
		s.log.Error("gateway budget check failed", "key", meta.KeyName, "error", err)
		return writeError(c, http.StatusInternalServerError, "budget check failed")
	}

	attempts := s.planWeb(routeCtx, targets)
	if len(attempts) == 0 {
		return writeError(c, http.StatusServiceUnavailable,
			"no connected provider for web "+capability+"; add an account for one on the Providers page")
	}

	ctx, cancel := context.WithTimeout(c.Context(), unaryDeadline)
	defer cancel()

	var last *core.ProviderError
	for _, at := range attempts {
		start := time.Now()
		body, err := run(ctx, at)
		latency := time.Since(start)
		if err == nil {
			s.recordUsage(usageRecord{
				APIKeyID: meta.APIKeyID, AccountID: at.AccountID,
				Provider: at.Target.Provider, Model: capability,
				Client: meta.Client, ClientIP: meta.ClientIP, RequestID: meta.RequestID,
				Latency: latency,
			})
			body["provider"] = at.Target.Provider
			c.Set("X-TeraRouter-Provider", at.Target.Provider)
			return c.Status(http.StatusOK).JSON(body)
		}

		last = core.AsProviderError(err)
		s.logFailure(last)
		s.noteFailure(last)
		s.recordFailure(meta, at.attempt, last, latency)
		// The same input fails identically everywhere; stop on a bad request
		// or once the client's deadline is gone.
		if last.Kind == core.ErrBadRequest || ctx.Err() != nil {
			break
		}
	}
	return writeError(c, statusForError(last), sanitizeErrorMessage(last.Message))
}

// planWeb expands web targets into usable, non-cooled-down accounts, capped
// at maxAttempts.
func (s *Server) planWeb(ctx context.Context, targets []target) []webAttempt {
	var out []webAttempt
	for _, t := range targets {
		spec, _ := catalog.Lookup(t.Provider)
		accounts, err := s.app.Repos.Accounts.ListUsable(ctx, t.Provider)
		if err != nil {
			s.log.Error("gateway list accounts failed", "provider", t.Provider, "error", err)
			continue
		}
		for _, acc := range accounts {
			if len(out) >= maxAttempts {
				return out
			}
			if s.cooldowns.active(acc.ID) {
				continue
			}
			creds, err := s.credentials(ctx, acc)
			if err != nil {
				s.log.Warn("gateway open credentials failed", "provider", t.Provider, "account", acc.ID, "error", err)
				continue
			}
			out = append(out, webAttempt{attempt: attempt{Target: t, Creds: creds, AccountID: acc.ID}, BaseURL: spec.BaseURL})
		}
	}
	return out
}
