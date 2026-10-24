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

// activityWeeks is how many week columns the activity calendar shows,
// including the current partial week.
const activityWeeks = 53

// Activity returns the activity calendar: requests per UTC day for the last
// 53 weeks (the grid starts on a Sunday) with each day's per-model counts.
func (h *usageHandler) Activity(c fiber.Ctx) error {
	ctx := c.Context()
	now := time.Now().UTC()
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
	from := today.AddDate(0, 0, -((activityWeeks-1)*7 + int(today.Weekday())))

	rows, err := h.app.Repos.Usage.Activity(ctx, from)
	if err != nil {
		return err
	}
	names, _, err := h.providerMeta(ctx)
	if err != nil {
		return err
	}

	out := dtos.UsageActivity{
		From: from.Format(time.DateOnly),
		To:   today.Format(time.DateOnly),
		Days: []dtos.UsageActivityDay{},
	}
	for _, r := range rows {
		if n := len(out.Days); n == 0 || out.Days[n-1].Day != r.Day {
			out.Days = append(out.Days, dtos.UsageActivityDay{Day: r.Day, Models: []dtos.UsageActivityModel{}})
		}
		day := &out.Days[len(out.Days)-1]
		day.Requests += r.Requests
		day.Failed += r.Failed
		day.Models = append(day.Models, dtos.UsageActivityModel{
			Provider:     r.Provider,
			ProviderName: providerDisplayName(names, r.Provider),
			Model:        r.Model,
			Requests:     r.Requests,
		})
		out.TotalRequests += r.Requests
	}
	out.ActiveDays = len(out.Days)
	return dtos.OK(c, out)
}
