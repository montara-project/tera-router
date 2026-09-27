package handlers

import (
	"encoding/json"

	"tera-router/server/internal/app"
	"tera-router/server/internal/dtos"
	"tera-router/server/internal/lib"
	"tera-router/server/internal/lib/apperr"
	"tera-router/server/internal/models"

	"github.com/gofiber/fiber/v3"
)

type providersHandler struct {
	app *app.Application
}

// Index returns the {connected, available} overview for the providers page.
func (h *providersHandler) Index(c fiber.Ctx) error {
	overview, err := h.app.Services.Providers.Overview(c.Context())
	if err != nil {
		return err
	}
	return dtos.OK(c, overview)
}

// Rates returns the pricing snapshot (overrides + catalog fallbacks).
func (h *providersHandler) Rates(c fiber.Ctx) error {
	rates, err := h.app.Services.Providers.Rates(c.Context())
	if err != nil {
		return err
	}
	return dtos.OK(c, rates)
}

// customProviderFrom converts a CustomProvider DTO into the stored model.
func customProviderFrom(d dtos.CustomProvider) models.CustomProvider {
	p := models.CustomProvider{
		Name:     d.Name,
		Slug:     d.Slug,
		BaseURL:  d.BaseURL,
		APIKind:  orDefault(d.APIKind, "openai"),
		Priority: d.Priority,
		Pricing:  encodeJSON(d.Pricing),
		Metadata: encodeJSON(d.Metadata),
		Enabled:  true,
	}
	if d.Enabled != nil {
		p.Enabled = *d.Enabled
	}
	return p
}

func encodeJSON(v any) string {
	if v == nil {
		return "{}"
	}
	raw, err := json.Marshal(v)
	if err != nil {
		return "{}"
	}
	return string(raw)
}

func (h *providersHandler) CustomIndex(c fiber.Ctx) error {
	providers, err := h.app.Services.Providers.CustomProviders(c.Context())
	if err != nil {
		return err
	}
	return dtos.List(c, providers, dtos.TotalMeta(len(providers)))
}

func (h *providersHandler) CustomStore(c fiber.Ctx) error {
	var req dtos.CustomProvider
	if err := lib.ValidateRequestBody(c, &req); err != nil {
		return err
	}

	provider, err := h.app.Services.Providers.CreateCustomProvider(c.Context(), actorFrom(c), customProviderFrom(req))
	if err != nil {
		return err
	}
	return dtos.Created(c, provider, "Provider created")
}

func (h *providersHandler) CustomUpdate(c fiber.Ctx) error {
	id, err := lib.ContextParamUUID(c, "id")
	if err != nil {
		return apperr.ErrBadRequest
	}

	var req dtos.CustomProvider
	if err := lib.ValidateRequestBody(c, &req); err != nil {
		return err
	}

	model := customProviderFrom(req)
	model.ID = id.String()
	provider, err := h.app.Services.Providers.UpdateCustomProvider(c.Context(), actorFrom(c), model)
	if err != nil {
		return err
	}
	return dtos.OK(c, provider)
}

func (h *providersHandler) CustomDelete(c fiber.Ctx) error {
	id, err := lib.ContextParamUUID(c, "id")
	if err != nil {
		return apperr.ErrBadRequest
	}

	if err := h.app.Services.Providers.DeleteCustomProvider(c.Context(), actorFrom(c), id.String()); err != nil {
		return err
	}
	return dtos.Deleted(c, "Provider deleted")
}

// --- Provider-scoped bulk account operations ---

func (h *providersHandler) AccountsBulkDisable(c fiber.Ctx) error {
	provider := c.Params("id")
	updated, err := h.app.Services.Accounts.SetDisabledByProvider(c.Context(), actorFrom(c), provider, true)
	if err != nil {
		return err
	}
	return dtos.OK(c, fiber.Map{"updated": updated})
}

func (h *providersHandler) AccountsBulkEnable(c fiber.Ctx) error {
	provider := c.Params("id")
	updated, err := h.app.Services.Accounts.SetDisabledByProvider(c.Context(), actorFrom(c), provider, false)
	if err != nil {
		return err
	}
	return dtos.OK(c, fiber.Map{"updated": updated})
}

func (h *providersHandler) AccountsBulkDeleteDisabled(c fiber.Ctx) error {
	provider := c.Params("id")
	deleted, err := h.app.Services.Accounts.DeleteDisabled(c.Context(), actorFrom(c), provider)
	if err != nil {
		return err
	}
	return dtos.OK(c, fiber.Map{"deleted": deleted})
}

func (h *providersHandler) AccountsBulkDeleteAll(c fiber.Ctx) error {
	provider := c.Params("id")
	deleted, err := h.app.Services.Accounts.DeleteAll(c.Context(), actorFrom(c), provider)
	if err != nil {
		return err
	}
	return dtos.OK(c, fiber.Map{"deleted": deleted})
}
