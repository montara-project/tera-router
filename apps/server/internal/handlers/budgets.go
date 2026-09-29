package handlers

import (
	"cmp"
	"time"

	"tera-router/server/internal/app"
	"tera-router/server/internal/dtos"
	"tera-router/server/internal/lib"
	"tera-router/server/internal/lib/apperr"
	"tera-router/server/internal/models"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
)

type budgetsHandler struct {
	app *app.Application
}

// periodWindow resolves the current period bucket and window start for a
// budget period (daily/weekly/monthly), ported from IDRouter's budget engine.
func periodWindow(period string, now time.Time) (bucket string, from time.Time) {
	switch period {
	case "daily":
		start := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
		return start.Format("2006-01-02"), start
	case "weekly":
		weekday := int(now.Weekday())
		if weekday == 0 {
			weekday = 7
		}
		start := time.Date(now.Year(), now.Month(), now.Day()-weekday+1, 0, 0, 0, 0, now.Location())
		return start.Format("2006-01-02"), start
	default: // monthly
		start := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
		return start.Format("2006-01"), start
	}
}

// budgetFromRequest builds a new budget from a create request.
func budgetFromRequest(d dtos.Budget) models.Budget {
	b := models.Budget{
		ScopeKind: models.BudgetScope(cmp.Or(d.ScopeKind, "tenant")),
		ScopeID:   d.ScopeID,
		Period:    cmp.Or(d.Period, "monthly"),
		AlertPct:  80,
	}
	if d.BudgetSpend != nil {
		b.LimitMicros = int64(*d.BudgetSpend * 1_000_000)
	}
	if d.LimitTokens != nil {
		b.LimitTokens = *d.LimitTokens
	}
	if d.AlertPct != nil {
		b.AlertPct = *d.AlertPct
	}
	if d.HardCutoff != nil {
		b.HardCutoff = *d.HardCutoff
	}
	return b
}

// resetAllocations seeds the remaining counters for a new period bucket.
func resetAllocations(b models.Budget, bucket string) models.Budget {
	b.PeriodBucket = bucket
	if b.LimitMicros > 0 {
		b.RemainingMicros = b.LimitMicros
	}
	if b.LimitTokens > 0 {
		b.RemainingTokens = b.LimitTokens
	}
	return b
}

// applyBudgetPatch overlays the fields the request actually supplied onto the
// stored budget. Rebuilding the row from the patch would drop limit_micros
// and hard_cutoff — silently removing the spend cap — whenever the dashboard
// PATCHes an unrelated field.
func applyBudgetPatch(b *models.Budget, d dtos.Budget) {
	if d.ScopeKind != "" {
		b.ScopeKind = models.BudgetScope(d.ScopeKind)
	}
	if d.ScopeID != "" {
		b.ScopeID = d.ScopeID
	}
	if d.Period != "" {
		b.Period = d.Period
	}
	if d.BudgetSpend != nil {
		b.LimitMicros = int64(*d.BudgetSpend * 1_000_000)
	}
	if d.LimitTokens != nil {
		b.LimitTokens = *d.LimitTokens
	}
	if d.AlertPct != nil {
		b.AlertPct = *d.AlertPct
	}
	if d.HardCutoff != nil {
		b.HardCutoff = *d.HardCutoff
	}
}

func (h *budgetsHandler) Index(c fiber.Ctx) error {
	budgets, err := h.app.Repos.Budgets.List(c.Context())
	if err != nil {
		return err
	}
	return dtos.List(c, budgets, dtos.TotalMeta(len(budgets)))
}

// Status computes spend vs limit for every budget over its current period,
// refreshing lazy allocations when the bucket rolled over.
func (h *budgetsHandler) Status(c fiber.Ctx) error {
	budgets, err := h.app.Repos.Budgets.List(c.Context())
	if err != nil {
		return err
	}

	out := make([]dtos.BudgetStatus, 0, len(budgets))
	for _, b := range budgets {
		if bucket, _ := periodWindow(b.Period, time.Now()); b.PeriodBucket != bucket {
			b = resetAllocations(b, bucket)
			if err := h.app.Repos.Budgets.Update(c.Context(), b); err != nil {
				return err
			}
		}

		_, from := periodWindow(b.Period, time.Now())
		spent, err := h.app.Repos.Usage.Summary(c.Context(), from)
		if err != nil {
			return err
		}

		out = append(out, dtos.BudgetStatus{
			Budget:      b,
			SpentMicros: spent.CostMicros,
			SpentTokens: spent.PromptTokens + spent.CompletionTokens,
			SpendPct:    percentOf(spent.CostMicros, b.LimitMicros),
			TokenPct:    percentOf(spent.PromptTokens+spent.CompletionTokens, b.LimitTokens),
		})
	}
	return dtos.List(c, out, dtos.TotalMeta(len(out)))
}

func percentOf(value, limit int64) float64 {
	if limit <= 0 {
		return 0
	}
	return float64(value) / float64(limit) * 100
}

func (h *budgetsHandler) Store(c fiber.Ctx) error {
	var req dtos.Budget
	if err := lib.ValidateRequestBody(c, &req); err != nil {
		return err
	}

	budget := budgetFromRequest(req)
	budget.ID = uuid.NewString()
	bucket, _ := periodWindow(budget.Period, time.Now())
	budget = resetAllocations(budget, bucket)

	if err := h.app.Repos.Budgets.Insert(c.Context(), budget); err != nil {
		return err
	}
	auditRecord(c.Context(), h.app, actorFrom(c), "budget.create", budget.ID, map[string]string{"scope": string(budget.ScopeKind)})
	return dtos.Created(c, budget, "Budget created")
}

// Update rewrites the budget and resets allocations to the new limits.
func (h *budgetsHandler) Update(c fiber.Ctx) error {
	id, err := lib.ContextParamUUID(c, "id")
	if err != nil {
		return apperr.ErrBadRequest
	}

	var req dtos.Budget
	if err := lib.ValidateRequestBody(c, &req); err != nil {
		return err
	}

	budget, err := h.app.Repos.Budgets.Get(c.Context(), id.String())
	if err != nil {
		return err
	}
	applyBudgetPatch(&budget, req)
	bucket, _ := periodWindow(budget.Period, time.Now())
	budget = resetAllocations(budget, bucket)

	if err := h.app.Repos.Budgets.Update(c.Context(), budget); err != nil {
		return err
	}
	auditRecord(c.Context(), h.app, actorFrom(c), "budget.update", budget.ID, nil)
	return dtos.OK(c, budget)
}

func (h *budgetsHandler) Delete(c fiber.Ctx) error {
	id, err := lib.ContextParamUUID(c, "id")
	if err != nil {
		return apperr.ErrBadRequest
	}

	if err := h.app.Repos.Budgets.Delete(c.Context(), id.String()); err != nil {
		return err
	}
	auditRecord(c.Context(), h.app, actorFrom(c), "budget.delete", id.String(), nil)
	return dtos.Deleted(c, "Budget deleted")
}
