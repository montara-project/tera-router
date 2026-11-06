package handlers

import (
	"errors"
	"slices"
	"strconv"
	"strings"
	"time"

	"tera-router/server/internal/app"
	"tera-router/server/internal/dtos"
	"tera-router/server/internal/lib/apperr"
	"tera-router/server/internal/lib/period"
	"tera-router/server/internal/models"

	"github.com/gofiber/fiber/v3"
)

// portalRanges are the windows the usage portal offers, in days.
var portalRanges = []int{7, 14, 30, 90}

// portalRecentLimit caps the request log the portal returns.
const portalRecentLimit = 200

type portalHandler struct {
	app *app.Application
}

// portalLimit is one spend or token cap on the key, with its current use.
type portalLimit struct {
	Label    string    `json:"label"`
	Kind     string    `json:"kind"` // "tokens" or "spend"
	Used     int64     `json:"used"`
	Limit    int64     `json:"limit"`
	ResetsAt time.Time `json:"resets_at"`
}

// Show serves the public usage portal of one API key (GET /v1/portal/:token).
// The token is the only credential: it reads that key's usage and nothing
// else, and it leaves out client IPs and error text.
func (h *portalHandler) Show(c fiber.Ctx) error {
	token := c.Params("token")
	if !strings.HasPrefix(token, "pt_") {
		return apperr.ErrNotFound
	}
	days, err := strconv.Atoi(c.Query("days", "30"))
	if err != nil || !slices.Contains(portalRanges, days) {
		return apperr.ErrBadRequest
	}

	ctx := c.Context()
	keyID, err := h.app.Repos.Portal.KeyID(ctx, token)
	if err != nil {
		return err
	}
	key, err := h.app.Repos.APIKeys.GetWithPlan(ctx, keyID)
	if err != nil {
		return err
	}

	now := time.Now()
	from := now.AddDate(0, 0, -days)
	summary, err := h.app.Repos.Usage.SummaryForKey(ctx, keyID, from)
	if err != nil {
		return err
	}
	_, monthStart := period.Window("monthly", now)
	month, err := h.app.Repos.Usage.SummaryForKey(ctx, keyID, monthStart)
	if err != nil {
		return err
	}
	daily, err := h.app.Repos.Usage.DailyForKey(ctx, keyID, from)
	if err != nil {
		return err
	}
	byModel, err := h.app.Repos.Usage.ByModelForKey(ctx, keyID, from)
	if err != nil {
		return err
	}
	recent, err := h.app.Repos.Usage.RecentForKey(ctx, keyID, from, portalRecentLimit)
	if err != nil {
		return err
	}

	var plan *models.Plan
	if key.PlanID != nil {
		p, err := h.app.Repos.Plans.Get(ctx, *key.PlanID)
		if err != nil && !errors.Is(err, apperr.ErrNotFound) {
			return err
		}
		if err == nil {
			plan = &p
		}
	}
	limits, err := h.keyLimits(c, keyID, plan, now)
	if err != nil {
		return err
	}

	// The key's own allowlist narrows its plan's; empty means every model.
	allowed := key.AllowedModels
	if len(allowed) == 0 && plan != nil {
		allowed = plan.AllowedModels
	}
	if allowed == nil {
		allowed = []string{}
	}

	view := keyView(key)
	return dtos.OK(c, fiber.Map{
		"key": fiber.Map{
			"name":        view["name"],
			"status":      view["status"],
			"key_preview": view["key_preview"],
			"plan_label":  view["plan_label"],
		},
		"days": days,
		"summary": fiber.Map{
			"requests":          summary.Requests,
			"prompt_tokens":     summary.PromptTokens,
			"completion_tokens": summary.CompletionTokens,
			"cost_micros":       summary.CostMicros,
		},
		"month": fiber.Map{
			"requests":    month.Requests,
			"cost_micros": month.CostMicros,
		},
		"daily":          daily,
		"models":         byModel,
		"recent":         recent,
		"limits":         limits,
		"allowed_models": allowed,
	})
}

// keyLimits lists the caps that block this key: its plan's and every budget
// scoped to the key. Instance-wide budgets are left out, since their use
// would show other keys' traffic.
func (h *portalHandler) keyLimits(c fiber.Ctx, keyID string, plan *models.Plan, now time.Time) ([]portalLimit, error) {
	out := []portalLimit{}
	add := func(periodName string, limitTokens, limitMicros int64) error {
		if limitTokens <= 0 && limitMicros <= 0 {
			return nil
		}
		_, from := period.Window(periodName, now)
		spent, err := h.app.Repos.Usage.SumSince(c.Context(), models.ScopeAPIKey, keyID, from)
		if err != nil {
			return err
		}
		resets := periodEnd(periodName, from)
		label := periodLabel(periodName)
		if limitTokens > 0 {
			out = append(out, portalLimit{Label: label + " tokens", Kind: "tokens", Used: spent.BudgetTokens, Limit: limitTokens, ResetsAt: resets})
		}
		if limitMicros > 0 {
			out = append(out, portalLimit{Label: label + " spend", Kind: "spend", Used: spent.CostMicros, Limit: limitMicros, ResetsAt: resets})
		}
		return nil
	}

	if plan != nil {
		if err := add(plan.Period, plan.LimitTokens, plan.LimitMicros); err != nil {
			return nil, err
		}
	}
	budgets, err := h.app.Repos.Budgets.List(c.Context())
	if err != nil {
		return nil, err
	}
	for _, b := range budgets {
		if b.ScopeKind == models.ScopeAPIKey && b.ScopeID == keyID {
			if err := add(b.Period, b.LimitTokens, b.LimitMicros); err != nil {
				return nil, err
			}
		}
	}
	return out, nil
}

// periodEnd is when the window that started at from rolls over.
func periodEnd(p string, from time.Time) time.Time {
	switch p {
	case "daily":
		return from.AddDate(0, 0, 1)
	case "weekly":
		return from.AddDate(0, 0, 7)
	default:
		return from.AddDate(0, 1, 0)
	}
}

func periodLabel(p string) string {
	switch p {
	case "daily":
		return "Daily"
	case "weekly":
		return "Weekly"
	default:
		return "Monthly"
	}
}
