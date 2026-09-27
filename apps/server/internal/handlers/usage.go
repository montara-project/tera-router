package handlers

import (
	"tera-router/server/internal/app"
	"tera-router/server/internal/dtos"

	"github.com/gofiber/fiber/v3"
)

type usageHandler struct {
	app *app.Application
}

// Summary returns totals for the requested range (?range=today|24h|7d|30d).
func (h *usageHandler) Summary(c fiber.Ctx) error {
	summary, err := h.app.Services.Usage.Summary(c.Context(), c.Query("range", "30d"))
	if err != nil {
		return err
	}
	return dtos.OK(c, summary)
}

// Models returns the per-provider/model breakdown.
func (h *usageHandler) Models(c fiber.Ctx) error {
	rows, err := h.app.Services.Usage.ByModel(c.Context(), c.Query("range", "30d"))
	if err != nil {
		return err
	}
	return dtos.List(c, rows, dtos.TotalMeta(len(rows)))
}

// Insights returns the daily series plus summary and model ranking.
func (h *usageHandler) Insights(c fiber.Ctx) error {
	insights, err := h.app.Services.Usage.Insights(c.Context(), c.Query("range", "30d"))
	if err != nil {
		return err
	}
	return dtos.OK(c, insights)
}
