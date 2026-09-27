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

// DefaultSettings seeds the settings document on first read.
func DefaultSettings() dtos.AppSettings {
	return dtos.AppSettings{
		RTKEnabled:             true,
		SourceCodeFilter:       "off",
		ProviderRoundRobin:     true,
		ProviderStickyLimit:    3,
		ConnectTimeout:         60,
		StreamStallTimeout:     300,
		RequestTimeout:         300,
		EnforceRateLimits:      true,
		RequestDetailRecording: true,
		BrandingDisplayName:    "Tera Router",
		BrandingTheme:          "forest-amber",
	}
}

// Get returns the settings document, falling back to defaults when absent.
func (h *settingsHandler) Get(c fiber.Ctx) error {
	settings, err := loadSettings(c.Context(), h.app.Repos.Settings)
	if err != nil {
		return err
	}
	return dtos.OK(c, settings)
}

// Update merges the posted settings patch over the stored document.
func (h *settingsHandler) Update(c fiber.Ctx) error {
	var req dtos.AppSettings
	if err := lib.ValidateRequestBody(c, &req); err != nil {
		return err
	}

	current, err := loadSettings(c.Context(), h.app.Repos.Settings)
	if err != nil {
		return err
	}

	merged := mergeSettings(current, req)
	raw, err := json.Marshal(merged)
	if err != nil {
		return err
	}
	if err := h.app.Repos.Settings.Put(c.Context(), settingsKey, string(raw)); err != nil {
		return err
	}
	auditRecord(c.Context(), h.app, actorFrom(c), "settings.update", settingsKey, req)
	return dtos.Item(c, fiber.StatusOK, merged, "Settings updated")
}

func loadSettings(ctx context.Context, settings *repositories.SettingRepository) (dtos.AppSettings, error) {
	raw, err := settings.Get(ctx, settingsKey)
	if err != nil {
		if errors.Is(err, apperr.ErrNotFound) {
			return DefaultSettings(), nil
		}
		return dtos.AppSettings{}, err
	}

	out := DefaultSettings()
	if err := json.Unmarshal([]byte(raw), &out); err != nil {
		return DefaultSettings(), nil
	}
	return out, nil
}

// mergeSettings applies only the fields the client explicitly set. The DTO
// binding gives zero values for absent fields, so fields merge by
// "patch is non-zero" semantics — matching the dashboard's PATCH-style use.
func mergeSettings(current, patch dtos.AppSettings) dtos.AppSettings {
	out := current

	// Booleans are always sent by the settings editor, so take them
	// wholesale from the patch document.
	out.RTKEnabled = patch.RTKEnabled
	out.CavemanEnabled = patch.CavemanEnabled
	out.TerseEnabled = patch.TerseEnabled
	out.HeadroomEnabled = patch.HeadroomEnabled
	out.PonytailEnabled = patch.PonytailEnabled
	out.ProviderRoundRobin = patch.ProviderRoundRobin
	out.ChainRoundRobin = patch.ChainRoundRobin
	out.EnforceRateLimits = patch.EnforceRateLimits
	out.OutboundProxyEnabled = patch.OutboundProxyEnabled
	out.RequestDetailRecording = patch.RequestDetailRecording

	if patch.SourceCodeFilter != "" {
		out.SourceCodeFilter = patch.SourceCodeFilter
	}
	if patch.ProviderStickyLimit != 0 {
		out.ProviderStickyLimit = patch.ProviderStickyLimit
	}
	if patch.ConnectTimeout != 0 {
		out.ConnectTimeout = patch.ConnectTimeout
	}
	if patch.StreamStallTimeout != 0 {
		out.StreamStallTimeout = patch.StreamStallTimeout
	}
	if patch.RequestTimeout != 0 {
		out.RequestTimeout = patch.RequestTimeout
	}
	if patch.BrandingDisplayName != "" {
		out.BrandingDisplayName = patch.BrandingDisplayName
	}
	out.BrandingTagline = patch.BrandingTagline
	if patch.BrandingTheme != "" {
		out.BrandingTheme = patch.BrandingTheme
	}
	return out
}
