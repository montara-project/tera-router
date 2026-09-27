package handlers

import (
	"time"

	"tera-router/server/internal/app"
	"tera-router/server/internal/dtos"

	"github.com/gofiber/fiber/v3"
)

type usageHandler struct {
	app *app.Application
}

// rangeStart resolves the window start for a named range
// (today, 24h, 7d, 30d). Unknown ranges mean the last 30 days.
func rangeStart(rng string) time.Time {
	now := time.Now()
	switch rng {
	case "today":
		return time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	case "7d":
		return now.Add(-7 * 24 * time.Hour)
	case "24h":
		return now.Add(-24 * time.Hour)
	default:
		return now.Add(-30 * 24 * time.Hour)
	}
}

// Summary returns totals for the requested range (?range=today|24h|7d|30d).
func (h *usageHandler) Summary(c fiber.Ctx) error {
	summary, err := h.app.Repos.Usage.Summary(c.Context(), rangeStart(c.Query("range", "30d")))
	if err != nil {
		return err
	}
	return dtos.OK(c, summary)
}

// Models returns the per-provider/model breakdown.
func (h *usageHandler) Models(c fiber.Ctx) error {
	rows, err := h.app.Repos.Usage.ByModel(c.Context(), rangeStart(c.Query("range", "30d")))
	if err != nil {
		return err
	}
	return dtos.List(c, rows, dtos.TotalMeta(len(rows)))
}

// Insights returns the daily series plus summary and model ranking.
func (h *usageHandler) Insights(c fiber.Ctx) error {
	rng := c.Query("range", "30d")
	from := rangeStart(rng)

	summary, err := h.app.Repos.Usage.Summary(c.Context(), from)
	if err != nil {
		return err
	}
	daily, err := h.app.Repos.Usage.Daily(c.Context(), from)
	if err != nil {
		return err
	}
	byModel, err := h.app.Repos.Usage.ByModel(c.Context(), from)
	if err != nil {
		return err
	}

	return dtos.OK(c, fiber.Map{
		"range":    rng,
		"summary":  summary,
		"daily":    daily,
		"by_model": byModel,
	})
}
