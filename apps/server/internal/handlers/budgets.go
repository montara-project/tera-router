package handlers

import (
	"cmp"
	"math"
	"sort"
	"time"

	"tera-router/server/internal/app"
	"tera-router/server/internal/dtos"
	"tera-router/server/internal/lib"
	"tera-router/server/internal/lib/apperr"
	"tera-router/server/internal/lib/period"
	"tera-router/server/internal/models"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
)

type budgetsHandler struct {
	app *app.Application
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
		b.LimitMicros = int64(math.Round(*d.BudgetSpend * 1_000_000))
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
		b.LimitMicros = int64(math.Round(*d.BudgetSpend * 1_000_000))
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
// budgetUsedPct is how full a budget is: the cap closest to running out
// decides.
func budgetUsedPct(b dtos.BudgetStatus) float64 {
	var pct float64
	if b.LimitMicros > 0 {
		pct = b.SpendPct
	}
	if b.LimitTokens > 0 {
		pct = max(pct, b.TokenPct)
	}
	return pct
}

// budgetScopeName resolves what a budget caps to a readable name. A scope
// that was deleted since yields "", and the dashboard falls back to its id.
func (h *budgetsHandler) budgetScopeName(c fiber.Ctx, b models.Budget) string {
	switch b.ScopeKind {
	case models.ScopeAPIKey:
		if key, err := h.app.Repos.APIKeys.Get(c.Context(), b.ScopeID); err == nil {
			return key.Name
		}
	case models.ScopeAccount:
		if account, err := h.app.Repos.Accounts.Get(c.Context(), b.ScopeID); err == nil {
			label := account.Label
			if label == "" {
				label = account.ID[:min(8, len(account.ID))]
			}
			return account.Provider + " · " + label
		}
	}
	return ""
}

// Status lists the budgets with their spend over the current period, the one
// closest to its limit first. The metadata carries the counts of the page's
// summary strip, taken over every budget; with `limit` the rows are one page.
func (h *budgetsHandler) Status(c fiber.Ctx) error {
	budgets, err := h.app.Repos.Budgets.List(c.Context())
	if err != nil {
		return err
	}

	out := make([]dtos.BudgetStatus, 0, len(budgets))
	for _, b := range budgets {
		if bucket, _ := period.Window(b.Period, time.Now()); b.PeriodBucket != bucket {
			b = resetAllocations(b, bucket)
			if err := h.app.Repos.Budgets.Update(c.Context(), b); err != nil {
				return err
			}
		}

		// Spend is narrowed to the budget's own scope (whole instance, one API
		// key, or one provider account), matching what the gateway enforces.
		_, from := period.Window(b.Period, time.Now())
		spent, err := h.app.Repos.Usage.SumSince(c.Context(), b.ScopeKind, b.ScopeID, from)
		if err != nil {
			return err
		}

		out = append(out, dtos.BudgetStatus{
			Budget:      b,
			ScopeName:   h.budgetScopeName(c, b),
			SpentMicros: spent.CostMicros,
			SpentTokens: spent.BudgetTokens,
			SpendPct:    percentOf(spent.CostMicros, b.LimitMicros),
			TokenPct:    percentOf(spent.BudgetTokens, b.LimitTokens),
			ResetsAt:    periodEnd(b.Period, from),
		})
	}
	sort.SliceStable(out, func(i, j int) bool { return budgetUsedPct(out[i]) > budgetUsedPct(out[j]) })

	var pastAlert, exhausted, blocking int
	for _, b := range out {
		switch pct := budgetUsedPct(b); {
		case pct >= 100:
			exhausted++
			if b.HardCutoff {
				blocking++
			}
		case b.AlertPct > 0 && pct >= float64(b.AlertPct):
			pastAlert++
		}
	}

	return respondList(c, out, dtos.Metadata{"past_alert": pastAlert, "exhausted": exhausted, "blocking": blocking})
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
	bucket, _ := period.Window(budget.Period, time.Now())
	budget = resetAllocations(budget, bucket)

	if err := h.app.Repos.Budgets.Insert(c.Context(), budget); err != nil {
		return err
	}
	auditRecord(c, actorFrom(c), "budget.create", budget.ID, map[string]string{"scope": string(budget.ScopeKind)})
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
	bucket, _ := period.Window(budget.Period, time.Now())
	budget = resetAllocations(budget, bucket)

	if err := h.app.Repos.Budgets.Update(c.Context(), budget); err != nil {
		return err
	}
	auditRecord(c, actorFrom(c), "budget.update", budget.ID, nil)
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
	auditRecord(c, actorFrom(c), "budget.delete", id.String(), nil)
	return dtos.Deleted(c, "Budget deleted")
}
