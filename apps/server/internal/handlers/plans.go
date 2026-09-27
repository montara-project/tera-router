package handlers

import (
	"tera-router/server/internal/app"
	"tera-router/server/internal/dtos"
	"tera-router/server/internal/lib"
	"tera-router/server/internal/lib/apperr"
	"tera-router/server/internal/models"

	"github.com/gofiber/fiber/v3"
)

type plansHandler struct {
	app *app.Application
}

// planView renders the web UI Plan model.
func planView(p models.Plan, keysAssigned int) fiber.Map {
	var budgetSpend, budgetTokens, alertPct any
	budgetSpend = nil
	budgetTokens = nil
	if p.LimitMicros > 0 {
		budgetSpend = float64(p.LimitMicros) / 1_000_000
	}
	if p.LimitTokens > 0 {
		budgetTokens = p.LimitTokens
	}
	alertPct = p.AlertPct

	var allowedModels any
	allowedModels = nil
	if len(p.AllowedModels) > 0 {
		allowedModels = p.AllowedModels
	}

	return fiber.Map{
		"id":             p.ID,
		"name":           p.Name,
		"description":    p.Description,
		"hardCutoff":     p.HardCutoff,
		"budgetSpend":    budgetSpend,
		"budgetTokens":   budgetTokens,
		"rpm":            p.RPM,
		"tpm":            p.TPM,
		"concurrent":     p.Concurrent,
		"allowedModels":  allowedModels,
		"keysAssigned":   keysAssigned,
		"alertAtPercent": alertPct,
		"period":         p.Period,
		"createdAt":      p.CreatedAt,
	}
}

func (h *plansHandler) Index(c fiber.Ctx) error {
	plans, err := h.app.Services.Plans.List(c.Context())
	if err != nil {
		return err
	}

	out := make([]fiber.Map, 0, len(plans))
	for _, p := range plans {
		out = append(out, planView(p.Plan, p.KeysAssigned))
	}
	return dtos.List(c, out, dtos.TotalMeta(len(plans)))
}

func (h *plansHandler) Store(c fiber.Ctx) error {
	var req dtos.Plan
	if err := lib.ValidateRequestBody(c, &req); err != nil {
		return err
	}

	plan := planFromRequest(req)
	plan.Name = orDefault(req.Name, "Plan")
	created, err := h.app.Services.Plans.Create(c.Context(), actorFrom(c), plan)
	if err != nil {
		return err
	}
	return dtos.Created(c, planView(created, 0), "Plan created")
}

func (h *plansHandler) Get(c fiber.Ctx) error {
	id, err := lib.ContextParamUUID(c, "id")
	if err != nil {
		return apperr.ErrBadRequest
	}

	plan, err := h.app.Services.Plans.Get(c.Context(), id.String())
	if err != nil {
		return err
	}
	return dtos.OK(c, planView(plan, 0))
}

func (h *plansHandler) Update(c fiber.Ctx) error {
	id, err := lib.ContextParamUUID(c, "id")
	if err != nil {
		return apperr.ErrBadRequest
	}

	var req dtos.Plan
	if err := lib.ValidateRequestBody(c, &req); err != nil {
		return err
	}

	plan := planFromRequest(req)
	plan.ID = id.String()
	plan.Name = orDefault(req.Name, "Plan")
	updated, err := h.app.Services.Plans.Update(c.Context(), actorFrom(c), plan)
	if err != nil {
		return err
	}
	return dtos.OK(c, planView(updated, 0))
}

func (h *plansHandler) Delete(c fiber.Ctx) error {
	id, err := lib.ContextParamUUID(c, "id")
	if err != nil {
		return apperr.ErrBadRequest
	}

	if err := h.app.Services.Plans.Delete(c.Context(), actorFrom(c), id.String()); err != nil {
		return err
	}
	return dtos.Deleted(c, "Plan deleted")
}

// Keys lists the keys assigned to one plan.
func (h *plansHandler) Keys(c fiber.Ctx) error {
	id, err := lib.ContextParamUUID(c, "id")
	if err != nil {
		return apperr.ErrBadRequest
	}

	keys, total, err := h.app.Services.Plans.Keys(c.Context(), id.String())
	if err != nil {
		return err
	}

	out := make([]fiber.Map, 0, len(keys))
	for _, k := range keys {
		out = append(out, keyView(k))
	}
	return dtos.List(c, out, dtos.TotalMeta(total))
}

func planFromRequest(req dtos.Plan) models.Plan {
	plan := models.Plan{
		Name:          req.Name,
		Description:   req.Description,
		Period:        orDefault(req.Period, "monthly"),
		AllowedModels: req.AllowedModels,
		RPM:           req.RPM,
		TPM:           req.TPM,
		Concurrent:    req.Concurrent,
	}
	if req.BudgetSpend != nil {
		plan.LimitMicros = int64(*req.BudgetSpend * 1_000_000)
	}
	if req.BudgetTokens != nil {
		plan.LimitTokens = *req.BudgetTokens
	}
	if req.AlertPct != nil {
		plan.AlertPct = *req.AlertPct
	}
	if req.HardCutoff != nil {
		plan.HardCutoff = *req.HardCutoff
	}
	return plan
}

func orDefault(value, fallback string) string {
	if value == "" {
		return fallback
	}
	return value
}
