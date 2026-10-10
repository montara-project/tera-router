package handlers

import (
	"tera-router/server/internal/app"
	"tera-router/server/internal/dtos"
	"tera-router/server/internal/lib/apperr"
	"tera-router/server/internal/repositories"

	"github.com/gofiber/fiber/v3"
)

type tunnelsHandler struct {
	app *app.Application
}

// Cloudflare reports whether cloudflared is installed on this host and the
// quick tunnel's public URL when one is up.
func (h *tunnelsHandler) Cloudflare(c fiber.Ctx) error {
	return dtos.OK(c, h.app.Services.Tunnel.Status())
}

// CloudflareEnable starts a Cloudflare quick tunnel to this server and
// returns its public *.trycloudflare.com URL. The choice is persisted so the
// tunnel comes back (with a new URL) after a server restart.
func (h *tunnelsHandler) CloudflareEnable(c fiber.Ctx) error {
	status, err := h.app.Services.Tunnel.Start(h.app.Config.App.Port)
	if err != nil {
		return apperr.New(apperr.KindUnprocessable, "%s", err.Error())
	}
	if err := h.app.Repos.Settings.Upsert(c.Context(), repositories.CloudflareTunnelSettingsKey, "true"); err != nil {
		return err
	}
	auditRecord(c.Context(), h.app, actorFrom(c), "tunnel.enable", "cloudflare", map[string]string{
		"url": status.URL,
	})
	return dtos.Item(c, fiber.StatusOK, status, "Cloudflare Tunnel enabled")
}

// CloudflareDisable stops the quick tunnel and keeps it off across restarts.
func (h *tunnelsHandler) CloudflareDisable(c fiber.Ctx) error {
	h.app.Services.Tunnel.Stop()
	if err := h.app.Repos.Settings.Upsert(c.Context(), repositories.CloudflareTunnelSettingsKey, "false"); err != nil {
		return err
	}
	auditRecord(c.Context(), h.app, actorFrom(c), "tunnel.disable", "cloudflare", nil)
	return dtos.Item(c, fiber.StatusOK, h.app.Services.Tunnel.Status(), "Cloudflare Tunnel disabled")
}
