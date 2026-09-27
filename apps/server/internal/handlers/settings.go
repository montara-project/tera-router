package handlers

import (
	"tera-router/server/internal/app"
	"tera-router/server/internal/dtos"
	"tera-router/server/internal/lib"
	"tera-router/server/internal/services"

	"github.com/gofiber/fiber/v3"
)

type settingsHandler struct {
	app *app.Application
}

// Get returns the settings document.
func (h *settingsHandler) Get(c fiber.Ctx) error {
	settings, err := h.app.Services.Settings.Get(c.Context())
	if err != nil {
		return err
	}
	return dtos.OK(c, settings)
}

// Update merges the posted settings patch.
func (h *settingsHandler) Update(c fiber.Ctx) error {
	var req services.AppSettings
	if err := lib.ValidateRequestBody(c, &req); err != nil {
		return err
	}

	settings, err := h.app.Services.Settings.Update(c.Context(), actorFrom(c), req)
	if err != nil {
		return err
	}
	return dtos.Item(c, fiber.StatusOK, settings, "Settings updated")
}
