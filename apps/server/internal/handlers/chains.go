package handlers

import (
	"cmp"
	"errors"
	"time"

	"tera-router/server/internal/app"
	"tera-router/server/internal/dtos"
	"tera-router/server/internal/lib"
	"tera-router/server/internal/lib/apperr"
	"tera-router/server/internal/models"
	"tera-router/server/internal/repositories"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
)

type chainsHandler struct {
	app *app.Application
}

// chainFromRequest converts a Chain DTO into the stored model.
func chainFromRequest(req dtos.Chain) models.Chain {
	chain := models.Chain{
		Name:             req.Name,
		Strategy:         cmp.Or(req.Strategy, "priority"),
		FallbackProvider: req.FallbackProvider,
		FallbackModel:    req.FallbackModel,
		ContextWindow:    req.ContextWindow,
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
		out = append(out, models.ChainStep{Provider: s.Provider, Model: s.Model})
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
	if req.FallbackProvider != "" {
		chain.FallbackProvider = req.FallbackProvider
	}
	if req.FallbackModel != "" {
		chain.FallbackModel = req.FallbackModel
	}
	if req.ContextWindow != 0 {
		chain.ContextWindow = req.ContextWindow
	}
	if req.Enabled != nil {
		chain.Enabled = *req.Enabled
	}
	if req.Steps != nil {
		chain.Steps = toChainSteps(*req.Steps)
	}
}

func (h *chainsHandler) Index(c fiber.Ctx) error {
	chains, err := h.app.Repos.Chains.List(c.Context())
	if err != nil {
		return err
	}
	return dtos.List(c, chains, dtos.TotalMeta(len(chains)))
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
	auditRecord(c.Context(), h.app, actorFrom(c), "chain.create", chain.ID, map[string]string{"name": chain.Name})

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
	auditRecord(c.Context(), h.app, actorFrom(c), "chain.update", chain.ID, nil)

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
	auditRecord(c.Context(), h.app, actorFrom(c), "chain.delete", id.String(), nil)
	return dtos.Deleted(c, "Chain deleted")
}

// Usage aggregates the models targeted by the chain's steps.
func (h *chainsHandler) Usage(c fiber.Ctx) error {
	id, err := lib.ContextParamUUID(c, "id")
	if err != nil {
		return apperr.ErrBadRequest
	}

	chain, err := h.app.Repos.Chains.Get(c.Context(), id.String())
	if err != nil {
		return err
	}
	all, err := h.app.Repos.Usage.ByModel(c.Context(), time.Time{})
	if err != nil {
		return err
	}

	targets := map[string]bool{}
	for _, step := range chain.Steps {
		targets[step.Provider+"\x00"+step.Model] = true
	}
	out := []repositories.UsageByModel{}
	for _, row := range all {
		if targets[row.Provider+"\x00"+row.Model] {
			out = append(out, row)
		}
	}
	return dtos.List(c, out, dtos.TotalMeta(len(out)))
}

// --- Model aliases ---

// aliasFromRequest converts an Alias DTO into the stored model.
func aliasFromRequest(req dtos.Alias) models.ModelAlias {
	alias := models.ModelAlias{
		Name:          req.Name,
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

func (h *chainsHandler) AliasIndex(c fiber.Ctx) error {
	aliases, err := h.app.Repos.Aliases.List(c.Context())
	if err != nil {
		return err
	}
	return dtos.List(c, aliases, dtos.TotalMeta(len(aliases)))
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

	if err := h.app.Repos.Aliases.Upsert(c.Context(), alias); err != nil {
		return err
	}
	auditRecord(c.Context(), h.app, actorFrom(c), "alias.put", alias.Name, map[string]int{"targets": len(alias.Targets)})

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
	auditRecord(c.Context(), h.app, actorFrom(c), "alias.delete", name, nil)
	return dtos.Deleted(c, "Alias deleted")
}
