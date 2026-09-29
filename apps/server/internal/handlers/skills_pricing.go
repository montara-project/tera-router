package handlers

import (
	"tera-router/server/internal/app"
	"tera-router/server/internal/dtos"
	"tera-router/server/internal/lib"
	"tera-router/server/internal/lib/apperr"
	"tera-router/server/internal/models"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
)

type skillsHandler struct {
	app *app.Application
}

func (h *skillsHandler) Index(c fiber.Ctx) error {
	skills, err := h.app.Repos.Skills.List(c.Context())
	if err != nil {
		return err
	}

	if skills == nil {
		skills = []models.Skill{}
	}
	return dtos.List(c, skills, dtos.TotalMeta(len(skills)))
}

func (h *skillsHandler) Store(c fiber.Ctx) error {
	var req dtos.CreateSkill
	if err := lib.ValidateRequestBody(c, &req); err != nil {
		return err
	}

	description := ""
	if req.Description != nil {
		description = *req.Description
	}

	skill := models.Skill{ID: uuid.NewString(), Name: req.Name, Description: description, Prompt: req.Prompt}
	if err := h.app.Repos.Skills.Insert(c.Context(), skill); err != nil {
		return err
	}
	auditRecord(c.Context(), h.app, actorFrom(c), "skill.create", skill.ID, map[string]string{"name": skill.Name})
	return dtos.Created(c, skill, "Skill created")
}

func (h *skillsHandler) Delete(c fiber.Ctx) error {
	id, err := lib.ContextParamUUID(c, "id")
	if err != nil {
		return apperr.ErrBadRequest
	}

	if err := h.app.Repos.Skills.Delete(c.Context(), id.String()); err != nil {
		return err
	}
	auditRecord(c.Context(), h.app, actorFrom(c), "skill.delete", id.String(), nil)
	return dtos.Deleted(c, "Skill deleted")
}

type pricingHandler struct {
	app *app.Application
}

// PricingIndex lists pricing overrides (?provider= filters one provider).
func (h *pricingHandler) PricingIndex(c fiber.Ctx) error {
	rows, err := h.app.Repos.Pricing.List(c.Context(), c.Query("provider"))
	if err != nil {
		return err
	}
	return dtos.List(c, rows, dtos.TotalMeta(len(rows)))
}

func (h *pricingHandler) PricingUpsert(c fiber.Ctx) error {
	var req dtos.Pricing
	if err := lib.ValidateRequestBody(c, &req); err != nil {
		return err
	}

	override := models.PricingOverride{
		ID:               uuid.NewString(),
		Provider:         req.Provider,
		Model:            req.Model,
		InputMicros:      req.InputMicros,
		OutputMicros:     req.OutputMicros,
		CacheReadMicros:  req.CacheReadMicros,
		CacheWriteMicros: req.CacheWriteMicros,
	}
	if err := h.app.Repos.Pricing.Upsert(c.Context(), override); err != nil {
		return err
	}
	auditRecord(c.Context(), h.app, actorFrom(c), "pricing.upsert", override.Provider+"/"+override.Model, nil)
	return dtos.OK(c, override)
}

func (h *pricingHandler) PricingDelete(c fiber.Ctx) error {
	provider, model := c.Query("provider"), c.Query("model")
	if provider == "" {
		return apperr.New(apperr.KindBadRequest, "provider query parameter is required")
	}

	if err := h.app.Repos.Pricing.Delete(c.Context(), provider, model); err != nil {
		return err
	}
	auditRecord(c.Context(), h.app, actorFrom(c), "pricing.delete", provider+"/"+model, nil)
	return dtos.Deleted(c, "Pricing override deleted")
}

func (h *pricingHandler) CapabilityIndex(c fiber.Ctx) error {
	rows, err := h.app.Repos.Capability.List(c.Context())
	if err != nil {
		return err
	}
	return dtos.List(c, rows, dtos.TotalMeta(len(rows)))
}

func (h *pricingHandler) CapabilityPut(c fiber.Ctx) error {
	var req dtos.Capability
	if err := lib.ValidateRequestBody(c, &req); err != nil {
		return err
	}

	override := models.CapabilityOverride{
		ID:           uuid.NewString(),
		Provider:     req.Provider,
		Model:        req.Model,
		Capabilities: req.Capabilities,
	}
	if err := h.app.Repos.Capability.Upsert(c.Context(), override); err != nil {
		return err
	}
	auditRecord(c.Context(), h.app, actorFrom(c), "capability.upsert", override.Provider+"/"+override.Model, override.Capabilities)
	return dtos.OK(c, override)
}

func (h *pricingHandler) CapabilityDelete(c fiber.Ctx) error {
	provider, model := c.Params("provider"), c.Params("model")
	if err := h.app.Repos.Capability.Delete(c.Context(), provider, model); err != nil {
		return err
	}
	auditRecord(c.Context(), h.app, actorFrom(c), "capability.delete", provider+"/"+model, nil)
	return dtos.Deleted(c, "Capability override deleted")
}

func (h *pricingHandler) CapabilityReset(c fiber.Ctx) error {
	if err := h.app.Repos.Capability.Reset(c.Context()); err != nil {
		return err
	}
	auditRecord(c.Context(), h.app, actorFrom(c), "capability.reset", "*", nil)
	return dtos.Message(c, fiber.StatusOK, "Capability overrides reset")
}
