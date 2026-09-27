package handlers

import (
	"tera-router/server/internal/app"
	"tera-router/server/internal/dtos"
	"tera-router/server/internal/lib"
	"tera-router/server/internal/lib/apperr"
	"tera-router/server/internal/lib/validator"
	"tera-router/server/internal/models"

	"github.com/gofiber/fiber/v3"
)

type skillsHandler struct {
	app *app.Application
}

type createSkillRequest struct {
	Name        string  `json:"name"`
	Description *string `json:"description"`
	Prompt      string  `json:"prompt"`
}

func (d *createSkillRequest) Validate(v *validator.MapValidator) {
	v.Field("name").Required().String()
	v.Field("prompt").Required().String()
}

func (h *skillsHandler) Index(c fiber.Ctx) error {
	skills, err := h.app.Services.Skills.List(c.Context())
	if err != nil {
		return err
	}

	if skills == nil {
		skills = []models.Skill{}
	}
	return dtos.List(c, skills, dtos.TotalMeta(len(skills)))
}

func (h *skillsHandler) Store(c fiber.Ctx) error {
	var req createSkillRequest
	if err := lib.ValidateRequestBody(c, &req); err != nil {
		return err
	}

	description := ""
	if req.Description != nil {
		description = *req.Description
	}

	skill, err := h.app.Services.Skills.Create(c.Context(), actorFrom(c), models.Skill{
		Name:        req.Name,
		Description: description,
		Prompt:      req.Prompt,
	})
	if err != nil {
		return err
	}
	return dtos.Created(c, skill, "Skill created")
}

func (h *skillsHandler) Delete(c fiber.Ctx) error {
	id, err := lib.ContextParamUUID(c, "id")
	if err != nil {
		return apperr.ErrBadRequest
	}

	if err := h.app.Services.Skills.Delete(c.Context(), actorFrom(c), id.String()); err != nil {
		return err
	}
	return dtos.Deleted(c, "Skill deleted")
}

type pricingHandler struct {
	app *app.Application
}

type pricingRequest struct {
	Provider         string `json:"provider"`
	Model            string `json:"model"`
	InputMicros      int64  `json:"input_micros"`
	OutputMicros     int64  `json:"output_micros"`
	CacheReadMicros  int64  `json:"cache_read_micros"`
	CacheWriteMicros int64  `json:"cache_write_micros"`
}

func (d *pricingRequest) Validate(v *validator.MapValidator) {
	v.Field("provider").Required().String()
}

type capabilityRequest struct {
	Provider     string   `json:"provider"`
	Model        string   `json:"model"`
	Capabilities []string `json:"capabilities"`
}

func (d *capabilityRequest) Validate(v *validator.MapValidator) {
	v.Field("provider").Required().String()
}

// PricingIndex lists pricing overrides (?provider= filters one provider).
func (h *pricingHandler) PricingIndex(c fiber.Ctx) error {
	rows, err := h.app.Services.Priming.ListPricing(c.Context(), c.Query("provider"))
	if err != nil {
		return err
	}
	return dtos.List(c, rows, dtos.TotalMeta(len(rows)))
}

func (h *pricingHandler) PricingUpsert(c fiber.Ctx) error {
	var req pricingRequest
	if err := lib.ValidateRequestBody(c, &req); err != nil {
		return err
	}

	override, err := h.app.Services.Priming.UpsertPricing(c.Context(), actorFrom(c), models.PricingOverride{
		Provider:         req.Provider,
		Model:            req.Model,
		InputMicros:      req.InputMicros,
		OutputMicros:     req.OutputMicros,
		CacheReadMicros:  req.CacheReadMicros,
		CacheWriteMicros: req.CacheWriteMicros,
	})
	if err != nil {
		return err
	}
	return dtos.OK(c, override)
}

func (h *pricingHandler) PricingDelete(c fiber.Ctx) error {
	provider, model := c.Query("provider"), c.Query("model")
	if provider == "" {
		return apperr.New(apperr.KindBadRequest, "provider query parameter is required")
	}

	if err := h.app.Services.Priming.DeletePricing(c.Context(), actorFrom(c), provider, model); err != nil {
		return err
	}
	return dtos.Deleted(c, "Pricing override deleted")
}

func (h *pricingHandler) CapabilityIndex(c fiber.Ctx) error {
	rows, err := h.app.Services.Priming.ListCapabilities(c.Context())
	if err != nil {
		return err
	}
	return dtos.List(c, rows, dtos.TotalMeta(len(rows)))
}

func (h *pricingHandler) CapabilityPut(c fiber.Ctx) error {
	var req capabilityRequest
	if err := lib.ValidateRequestBody(c, &req); err != nil {
		return err
	}

	override, err := h.app.Services.Priming.UpsertCapability(c.Context(), actorFrom(c), models.CapabilityOverride{
		Provider:     req.Provider,
		Model:        req.Model,
		Capabilities: req.Capabilities,
	})
	if err != nil {
		return err
	}
	return dtos.OK(c, override)
}

func (h *pricingHandler) CapabilityDelete(c fiber.Ctx) error {
	provider, model := c.Params("provider"), c.Params("model")
	if err := h.app.Services.Priming.DeleteCapability(c.Context(), actorFrom(c), provider, model); err != nil {
		return err
	}
	return dtos.Deleted(c, "Capability override deleted")
}

func (h *pricingHandler) CapabilityReset(c fiber.Ctx) error {
	if err := h.app.Services.Priming.ResetCapabilities(c.Context(), actorFrom(c)); err != nil {
		return err
	}
	return dtos.Message(c, fiber.StatusOK, "Capability overrides reset")
}
