package handlers

import (
	"tera-router/server/internal/app"
	"tera-router/server/internal/dtos"
	"tera-router/server/internal/lib"
	"tera-router/server/internal/lib/apperr"
	"tera-router/server/internal/lib/validator"
	"tera-router/server/internal/models"

	"github.com/gofiber/fiber/v3"
)

type budgetsHandler struct {
	app *app.Application
}

type budgetRequest struct {
	ScopeKind   string   `json:"scope_kind"`
	ScopeID     string   `json:"scope_id"`
	BudgetSpend *float64 `json:"budget_spend"` // USD; stored as micros
	LimitTokens *int64   `json:"limit_tokens"`
	Period      string   `json:"period"`
	AlertPct    *int     `json:"alert_pct"`
	HardCutoff  *bool    `json:"hard_cutoff"`
}

func (d *budgetRequest) Validate(v *validator.MapValidator) {
	v.Field("scope_kind").WithinS("tenant", "api_key", "account")
	v.Field("period").WithinS("daily", "weekly", "monthly")
}

func (d *budgetRequest) toModel() models.Budget {
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
	var req budgetRequest
	if err := lib.ValidateRequestBody(c, &req); err != nil {
		return err
	}

	budget, err := h.app.Services.Budgets.Create(c.Context(), actorFrom(c), req.toModel())
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

	var req budgetRequest
	if err := lib.ValidateRequestBody(c, &req); err != nil {
		return err
	}

	budget := req.toModel()
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
