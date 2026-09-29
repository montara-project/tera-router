package handlers

import (
	"context"
	"encoding/json"
	"errors"

	"tera-router/server/internal/app"
	"tera-router/server/internal/dtos"
	"tera-router/server/internal/lib"
	"tera-router/server/internal/lib/apperr"
	"tera-router/server/internal/repositories"

	"github.com/gofiber/fiber/v3"
)

const settingsKey = "app"

type settingsHandler struct {
	app *app.Application
}

// Get returns the settings document, falling back to defaults when absent.
func (h *settingsHandler) Get(c fiber.Ctx) error {
	settings, err := loadSettings(c.Context(), h.app.Repos.Settings)
	if err != nil {
		return err
	}
	return dtos.OK(c, settings)
}

// Update merges the posted settings patch over the stored document. The
// dashboard sends only the fields the user changed, so absent fields keep
// their stored value.
func (h *settingsHandler) Update(c fiber.Ctx) error {
	var req dtos.AppSettings
	if err := lib.ValidateRequestBody(c, &req); err != nil {
		return err
	}

	current, err := loadSettings(c.Context(), h.app.Repos.Settings)
	if err != nil {
		return err
	}

	merged := dtos.MergeSettings(current, req)
	raw, err := json.Marshal(merged)
	if err != nil {
		return err
	}
	if err := h.app.Repos.Settings.Upsert(c.Context(), settingsKey, string(raw)); err != nil {
		return err
	}
	auditRecord(c.Context(), h.app, actorFrom(c), "settings.update", settingsKey, req)
	return dtos.Item(c, fiber.StatusOK, merged, "Settings updated")
}

func loadSettings(ctx context.Context, settings *repositories.SettingRepository) (dtos.AppSettings, error) {
	raw, err := settings.Get(ctx, settingsKey)
	if err != nil {
		if errors.Is(err, apperr.ErrNotFound) {
			return dtos.DefaultSettings(), nil
		}
		return dtos.AppSettings{}, err
	}
	return dtos.UnmarshalSettings([]byte(raw))
}
