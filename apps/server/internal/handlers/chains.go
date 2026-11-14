package handlers

import (
	"cmp"
	"errors"
	"strings"

	"tera-router/server/internal/app"
	"tera-router/server/internal/dtos"
	"tera-router/server/internal/lib"
	"tera-router/server/internal/lib/apperr"
	"tera-router/server/internal/models"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
)

type chainsHandler struct {
	app *app.Application
}

// deref reads an optional request field, zero when omitted.
func deref[T any](p *T) T {
	if p == nil {
		var zero T
		return zero
	}
	return *p
}

// chainFromRequest converts a Chain DTO into the stored model.
func chainFromRequest(req dtos.Chain) models.Chain {
	chain := models.Chain{
		Name:             req.Name,
		Strategy:         cmp.Or(req.Strategy, "priority"),
		FallbackProvider: deref(req.FallbackProvider),
		FallbackModel:    deref(req.FallbackModel),
		ContextWindow:    deref(req.ContextWindow),
		Enabled:          true,
	}
	if req.Enabled != nil {
		chain.Enabled = *req.Enabled
	}
	if req.Steps != nil {
		chain.Steps = toChainSteps(*req.Steps)
	}
	return chain
}

// toChainSteps maps request steps onto stored steps.
func toChainSteps(in []dtos.ChainStep) []models.ChainStep {
	out := make([]models.ChainStep, 0, len(in))
	for _, s := range in {
		step := models.ChainStep{Provider: s.Provider, Model: s.Model, Active: true}
		if s.Active != nil {
			step.Active = *s.Active
		}
		out = append(out, step)
	}
	return out
}

// applyChainPatch overlays the fields the request actually supplied onto the
// stored chain. Writing a freshly built model would blank every omitted field
// and — because the update replaces the whole step list — silently clear the
// chain's routing.
func applyChainPatch(chain *models.Chain, req dtos.Chain) {
	if req.Name != "" {
		chain.Name = req.Name
	}
	if req.Strategy != "" {
		chain.Strategy = req.Strategy
	}
	if req.FallbackProvider != nil {
		chain.FallbackProvider = *req.FallbackProvider
	}
	if req.FallbackModel != nil {
		chain.FallbackModel = *req.FallbackModel
	}
	if req.ContextWindow != nil {
		chain.ContextWindow = *req.ContextWindow
	}
	if req.Enabled != nil {
		chain.Enabled = *req.Enabled
	}
	if req.Steps != nil {
		chain.Steps = toChainSteps(*req.Steps)
	}
}

// chainRow is one chain of the list, with its health entry when the request
// asked for a health window and the chain had traffic in it.
type chainRow struct {
	models.Chain
	Health *healthEntry `json:"health,omitempty"`
}

// healthStatusOf names a chain's health; a chain with no entry is "unknown".
func (r chainRow) healthStatusOf() string {
	if r.Health == nil {
		return "unknown"
	}
	return r.Health.Status
}

// Index lists the chains. Every parameter is optional:
//
//   - health_window (5m … 90d) attaches each chain's health over that window
//     and is what the health filter and counts read
//   - search matches the chain name, the fallback model or a step's
//     provider/model
//   - strategy, health (healthy, degraded, down, unknown), enabled
//     (true/false) and provider (a step or the fallback uses it) narrow the rows
//   - limit and offset cut one page
//
// The metadata counts the chains per strategy and per health status before
// any filter, for the labels of the page's filters.
func (h *chainsHandler) Index(c fiber.Ctx) error {
	chains, err := h.app.Repos.Chains.List(c.Context())
	if err != nil {
		return err
	}
	rows := make([]chainRow, 0, len(chains))
	for _, ch := range chains {
		rows = append(rows, chainRow{Chain: ch})
	}
	if lookback, ok := healthWindows[c.Query("health_window")]; ok {
		overview, err := healthOverviewFor(c.Context(), h.app, lookback)
		if err != nil {
			return err
		}
		byName := make(map[string]*healthEntry, len(overview.Chains))
		for i := range overview.Chains {
			byName[overview.Chains[i].Name] = &overview.Chains[i]
		}
		for i := range rows {
			rows[i].Health = byName[rows[i].Name]
		}
	}

	extra := dtos.Metadata{"total_all": len(rows)}
	for _, r := range rows {
		for _, key := range []string{"count_strategy_" + r.Strategy, "count_health_" + r.healthStatusOf()} {
			n, _ := extra[key].(int)
			extra[key] = n + 1
		}
	}

	search := listSearch(c)
	strategy, health, enabled, provider := c.Query("strategy"), c.Query("health"), c.Query("enabled"), c.Query("provider")
	rows = keep(rows, func(r chainRow) bool {
		if strategy != "" && r.Strategy != strategy {
			return false
		}
		if health != "" && r.healthStatusOf() != health {
			return false
		}
		if enabled != "" && r.Enabled != (enabled == "true") {
			return false
		}
		fields := []string{r.Name, r.FallbackModel}
		usesProvider := r.FallbackProvider == provider
		for _, s := range r.Steps {
			fields = append(fields, s.Provider+"/"+s.Model)
			usesProvider = usesProvider || s.Provider == provider
		}
		if provider != "" && !usesProvider {
			return false
		}
		return matchesSearch(search, fields...)
	})
	return respondList(c, rows, extra)
}

func (h *chainsHandler) Store(c fiber.Ctx) error {
	var req dtos.Chain
	if err := lib.ValidateRequestBody(c, &req); err != nil {
		return err
	}

	chain := chainFromRequest(req)
	chain.ID = uuid.NewString()
	for i := range chain.Steps {
		chain.Steps[i].ID = uuid.NewString()
		chain.Steps[i].ChainID = chain.ID
		chain.Steps[i].Position = i + 1
	}

	if err := h.app.Repos.Chains.Insert(c.Context(), chain); err != nil {
		return err
	}
	auditRecord(c, actorFrom(c), "chain.create", chain.ID, map[string]string{"name": chain.Name})

	created, err := h.app.Repos.Chains.Get(c.Context(), chain.ID)
	if err != nil {
		return err
	}
	return dtos.Created(c, created, "Chain created")
}

func (h *chainsHandler) Get(c fiber.Ctx) error {
	id, err := lib.ContextParamUUID(c, "id")
	if err != nil {
		return apperr.ErrBadRequest
	}

	chain, err := h.app.Repos.Chains.Get(c.Context(), id.String())
	if err != nil {
		return err
	}
	return dtos.OK(c, chain)
}

func (h *chainsHandler) Update(c fiber.Ctx) error {
	id, err := lib.ContextParamUUID(c, "id")
	if err != nil {
		return apperr.ErrBadRequest
	}

	var req dtos.Chain
	if err := lib.ValidateRequestBody(c, &req); err != nil {
		return err
	}

	chain, err := h.app.Repos.Chains.Get(c.Context(), id.String())
	if err != nil {
		return err
	}
	applyChainPatch(&chain, req)
	for i := range chain.Steps {
		chain.Steps[i].ID = uuid.NewString()
		chain.Steps[i].ChainID = chain.ID
		chain.Steps[i].Position = i + 1
	}

	if err := h.app.Repos.Chains.Update(c.Context(), chain); err != nil {
		return err
	}
	auditRecord(c, actorFrom(c), "chain.update", chain.ID, nil)

	updated, err := h.app.Repos.Chains.Get(c.Context(), chain.ID)
	if err != nil {
		return err
	}
	return dtos.OK(c, updated)
}

func (h *chainsHandler) Delete(c fiber.Ctx) error {
	id, err := lib.ContextParamUUID(c, "id")
	if err != nil {
		return apperr.ErrBadRequest
	}

	if err := h.app.Repos.Chains.Delete(c.Context(), id.String()); err != nil {
		return err
	}
	auditRecord(c, actorFrom(c), "chain.delete", id.String(), nil)
	return dtos.Deleted(c, "Chain deleted")
}

// --- Model aliases ---

// aliasFromRequest converts an Alias DTO into the stored model.
func aliasFromRequest(req dtos.Alias) models.ModelAlias {
	alias := models.ModelAlias{
		Name:          req.Name,
		Group:         strings.TrimSpace(req.Group),
		ContextWindow: req.ContextWindow,
		Active:        true,
		Targets:       make([]models.AliasTarget, 0, len(req.Targets)),
	}
	if req.Active != nil {
		alias.Active = *req.Active
	}
	for _, t := range req.Targets {
		target := models.AliasTarget{Provider: t.Provider, Model: t.Model, Active: true}
		if t.Active != nil {
			target.Active = *t.Active
		}
		alias.Targets = append(alias.Targets, target)
	}
	return alias
}

// AliasIndex lists the model aliases. `search` matches the alias name or its
// group, and `status` keeps the active or the inactive ones.
func (h *chainsHandler) AliasIndex(c fiber.Ctx) error {
	aliases, err := h.app.Repos.Aliases.List(c.Context())
	if err != nil {
		return err
	}
	search, status := listSearch(c), c.Query("status")
	aliases = keep(aliases, func(a models.ModelAlias) bool {
		if status == "active" && !a.Active || status == "inactive" && a.Active {
			return false
		}
		return matchesSearch(search, a.Name, a.Group)
	})
	return respondList(c, aliases)
}

// AliasPut upserts one alias pool by name (PUT semantics from IDRouter).
func (h *chainsHandler) AliasPut(c fiber.Ctx) error {
	var req dtos.Alias
	if err := lib.ValidateRequestBody(c, &req); err != nil {
		return err
	}

	alias := aliasFromRequest(req)
	if alias.ID == "" {
		alias.ID = uuid.NewString()
	}
	for i := range alias.Targets {
		alias.Targets[i].ID = uuid.NewString()
		alias.Targets[i].AliasID = alias.ID
		alias.Targets[i].Position = i + 1
	}

	if req.PreviousName != "" && req.PreviousName != alias.Name {
		if err := h.app.Repos.Aliases.Rename(c.Context(), req.PreviousName, alias); err != nil {
			return err
		}
		auditRecord(c, actorFrom(c), "alias.rename", alias.Name, map[string]string{"from": req.PreviousName})
	} else if err := h.app.Repos.Aliases.Upsert(c.Context(), alias); err != nil {
		return err
	}
	auditRecord(c, actorFrom(c), "alias.put", alias.Name, map[string]int{"targets": len(alias.Targets)})

	existing, err := h.app.Repos.Aliases.GetByName(c.Context(), alias.Name)
	if err != nil {
		if errors.Is(err, apperr.ErrNotFound) {
			return dtos.OK(c, alias)
		}
		return err
	}
	return dtos.OK(c, existing)
}

// AliasDelete removes an alias pool by name.
func (h *chainsHandler) AliasDelete(c fiber.Ctx) error {
	name := c.Params("name")
	if name == "" {
		return apperr.ErrBadRequest
	}

	if err := h.app.Repos.Aliases.Delete(c.Context(), name); err != nil {
		return err
	}
	auditRecord(c, actorFrom(c), "alias.delete", name, nil)
	return dtos.Deleted(c, "Alias deleted")
}
