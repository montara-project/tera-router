package handlers

import (
	"tera-router/server/internal/app"
	"tera-router/server/internal/dtos"
	"tera-router/server/internal/lib"
	"tera-router/server/internal/lib/apperr"
	"tera-router/server/internal/models"

	"github.com/gofiber/fiber/v3"
)

type chainsHandler struct {
	app *app.Application
}

func chainFromRequest(req dtos.Chain) models.Chain {
	chain := models.Chain{
		Name:             req.Name,
		Strategy:         orDefault(req.Strategy, "priority"),
		FallbackProvider: req.FallbackProvider,
		FallbackModel:    req.FallbackModel,
		ContextWindow:    req.ContextWindow,
		Enabled:          true,
		Steps:            make([]models.ChainStep, 0, len(req.Steps)),
	}
	if req.Enabled != nil {
		chain.Enabled = *req.Enabled
	}
	for _, s := range req.Steps {
		chain.Steps = append(chain.Steps, models.ChainStep{Provider: s.Provider, Model: s.Model})
	}
	return chain
}

func (h *chainsHandler) Index(c fiber.Ctx) error {
	chains, err := h.app.Services.Chains.List(c.Context())
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

	chain, err := h.app.Services.Chains.Create(c.Context(), actorFrom(c), chainFromRequest(req))
	if err != nil {
		return err
	}
	return dtos.Created(c, chain, "Chain created")
}

func (h *chainsHandler) Get(c fiber.Ctx) error {
	id, err := lib.ContextParamUUID(c, "id")
	if err != nil {
		return apperr.ErrBadRequest
	}

	chain, err := h.app.Services.Chains.Get(c.Context(), id.String())
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

	chain := chainFromRequest(req)
	chain.ID = id.String()
	updated, err := h.app.Services.Chains.Update(c.Context(), actorFrom(c), chain)
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

	if err := h.app.Services.Chains.Delete(c.Context(), actorFrom(c), id.String()); err != nil {
		return err
	}
	return dtos.Deleted(c, "Chain deleted")
}

// Usage aggregates the models targeted by the chain's steps.
func (h *chainsHandler) Usage(c fiber.Ctx) error {
	id, err := lib.ContextParamUUID(c, "id")
	if err != nil {
		return apperr.ErrBadRequest
	}

	rows, err := h.app.Services.Chains.Usage(c.Context(), id.String())
	if err != nil {
		return err
	}
	return dtos.List(c, rows, dtos.TotalMeta(len(rows)))
}

// --- Model aliases ---

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
	aliases, err := h.app.Services.Chains.AliasList(c.Context())
	if err != nil {
		return err
	}
	return dtos.List(c, aliases, dtos.TotalMeta(len(aliases)))
}

func (h *chainsHandler) AliasPut(c fiber.Ctx) error {
	var req dtos.Alias
	if err := lib.ValidateRequestBody(c, &req); err != nil {
		return err
	}

	alias, err := h.app.Services.Chains.AliasPut(c.Context(), actorFrom(c), aliasFromRequest(req))
	if err != nil {
		return err
	}
	return dtos.OK(c, alias)
}

func (h *chainsHandler) AliasDelete(c fiber.Ctx) error {
	name := c.Query("name")
	if name == "" {
		return apperr.New(apperr.KindBadRequest, "name query parameter is required")
	}

	if err := h.app.Services.Chains.AliasDelete(c.Context(), actorFrom(c), name); err != nil {
		return err
	}
	return dtos.Deleted(c, "Alias deleted")
}
