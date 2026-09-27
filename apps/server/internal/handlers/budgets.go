package handlers

import (
	"tera-router/server/internal/app"
	"tera-router/server/internal/dtos"
	"tera-router/server/internal/lib"
	"tera-router/server/internal/lib/apperr"
	"tera-router/server/internal/models"

	"github.com/gofiber/fiber/v3"
)

type budgetsHandler struct {
	app *app.Application
}

// budgetFromRequest converts a Budget DTO into the stored model.
func budgetFromRequest(d dtos.Budget) models.Budget {
	b := models.Budget{
		ScopeKind: models.BudgetScope(orDefault(d.ScopeKind, "tenant")),
		ScopeID:   d.ScopeID,
		Period:    orDefault(d.Period, "monthly"),
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

func (h *budgetsHandler) Index(c fiber.Ctx) error {
	budgets, err := h.app.Services.Budgets.List(c.Context())
	if err != nil {
		return err
	}
	return dtos.List(c, budgets, dtos.TotalMeta(len(budgets)))
}

func (h *budgetsHandler) Status(c fiber.Ctx) error {
	status, err := h.app.Services.Budgets.Status(c.Context())
	if err != nil {
		return err
	}
	return dtos.List(c, status, dtos.TotalMeta(len(status)))
}

func (h *budgetsHandler) Store(c fiber.Ctx) error {
	var req dtos.Budget
	if err := lib.ValidateRequestBody(c, &req); err != nil {
		return err
	}

	budget, err := h.app.Services.Budgets.Create(c.Context(), actorFrom(c), budgetFromRequest(req))
	if err != nil {
		return err
	}
	return dtos.Created(c, budget, "Budget created")
}

func (h *budgetsHandler) Update(c fiber.Ctx) error {
	id, err := lib.ContextParamUUID(c, "id")
	if err != nil {
		return apperr.ErrBadRequest
	}

	var req dtos.Budget
	if err := lib.ValidateRequestBody(c, &req); err != nil {
		return err
	}

	budget := budgetFromRequest(req)
	budget.ID = id.String()
	updated, err := h.app.Services.Budgets.Update(c.Context(), actorFrom(c), budget)
	if err != nil {
		return err
	}
	return dtos.OK(c, updated)
}

func (h *budgetsHandler) Delete(c fiber.Ctx) error {
	id, err := lib.ContextParamUUID(c, "id")
	if err != nil {
		return apperr.ErrBadRequest
	}

	if err := h.app.Services.Budgets.Delete(c.Context(), actorFrom(c), id.String()); err != nil {
		return err
	}
	return dtos.Deleted(c, "Budget deleted")
}
