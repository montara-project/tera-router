package handlers

import (
	"tera-router/server/internal/app"
	"tera-router/server/internal/dtos"
	"tera-router/server/internal/lib"
	"tera-router/server/internal/lib/apperr"
	"tera-router/server/internal/models"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
)

type plansHandler struct {
	app *app.Application
}

// planView renders the web UI Plan model.
func planView(p models.Plan, keysAssigned int) fiber.Map {
	var budgetSpend, budgetTokens any
	if p.LimitMicros > 0 {
		budgetSpend = float64(p.LimitMicros) / 1_000_000
	}
	if p.LimitTokens > 0 {
		budgetTokens = p.LimitTokens
	}

	var allowedModels any
	if len(p.AllowedModels) > 0 {
		allowedModels = p.AllowedModels
	}

	return fiber.Map{
		"id":               p.ID,
		"name":             p.Name,
		"description":      p.Description,
		"hard_cutoff":      p.HardCutoff,
		"budget_spend":     budgetSpend,
		"budget_tokens":    budgetTokens,
		"rpm":              p.RPM,
		"tpm":              p.TPM,
		"concurrent":       p.Concurrent,
		"allowed_models":   allowedModels,
		"keys_assigned":    keysAssigned,
		"alert_at_percent": p.AlertPct,
		"period":           p.Period,
		"created_at":       p.CreatedAt,
	}
}

func (h *plansHandler) Index(c fiber.Ctx) error {
	plans, err := h.app.Repos.Plans.List(c.Context())
	if err != nil {
		return err
	}
	counts, err := h.app.Repos.APIKeys.CountByPlan(c.Context())
	if err != nil {
		return err
	}

	out := make([]fiber.Map, 0, len(plans))
	for _, p := range plans {
		out = append(out, planView(p, counts[p.ID]))
	}
	return dtos.List(c, out, dtos.TotalMeta(len(plans)))
}

// planFromRequest converts a Plan DTO into the stored model.
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

func (h *plansHandler) Store(c fiber.Ctx) error {
	var req dtos.Plan
	if err := lib.ValidateRequestBody(c, &req); err != nil {
		return err
	}

	plan := planFromRequest(req)
	plan.ID = uuid.NewString()
	plan.Name = orDefault(req.Name, "Plan")
	if err := h.app.Repos.Plans.Insert(c.Context(), plan); err != nil {
		return err
	}
	auditRecord(c.Context(), h.app, actorFrom(c), "plan.create", plan.ID, map[string]string{"name": plan.Name})
	return dtos.Created(c, planView(plan, 0), "Plan created")
}

func (h *plansHandler) Get(c fiber.Ctx) error {
	id, err := lib.ContextParamUUID(c, "id")
	if err != nil {
		return apperr.ErrBadRequest
	}

	plan, err := h.app.Repos.Plans.Get(c.Context(), id.String())
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
	if err := h.app.Repos.Plans.Update(c.Context(), plan); err != nil {
		return err
	}
	auditRecord(c.Context(), h.app, actorFrom(c), "plan.update", plan.ID, nil)

	updated, err := h.app.Repos.Plans.Get(c.Context(), plan.ID)
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

	if err := h.app.Repos.Plans.Delete(c.Context(), id.String()); err != nil {
		return err
	}
	auditRecord(c.Context(), h.app, actorFrom(c), "plan.delete", id.String(), nil)
	return dtos.Deleted(c, "Plan deleted")
}

// Keys lists the keys assigned to one plan.
func (h *plansHandler) Keys(c fiber.Ctx) error {
	id, err := lib.ContextParamUUID(c, "id")
	if err != nil {
		return apperr.ErrBadRequest
	}

	if _, err := h.app.Repos.Plans.Get(c.Context(), id.String()); err != nil {
		return err
	}

	keys, _, err := h.app.Repos.APIKeys.List(c.Context(), 0, 100)
	if err != nil {
		return err
	}

	out := []fiber.Map{}
	for _, k := range keys {
		if k.PlanID != nil && *k.PlanID == id.String() {
			out = append(out, keyView(k))
		}
	}
	return dtos.List(c, out, dtos.TotalMeta(len(out)))
}

func orDefault(value, fallback string) string {
	if value == "" {
		return fallback
	}
	return value
}
