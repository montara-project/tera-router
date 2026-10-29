package handlers

import (
	"cmp"
	"time"

	"tera-router/server/internal/app"
	"tera-router/server/internal/dtos"
	"tera-router/server/internal/lib"
	"tera-router/server/internal/lib/apperr"
	"tera-router/server/internal/lib/period"
	"tera-router/server/internal/models"
	"tera-router/server/internal/repositories"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
)

type plansHandler struct {
	app *app.Application
}

// planKeyUsage is one assigned key's spend against its plan's per-key caps
// over the plan's current period.
type planKeyUsage struct {
	ID          string  `json:"id"`
	Name        string  `json:"name"`
	SpentMicros int64   `json:"spent_micros"`
	SpentTokens int64   `json:"spent_tokens"`
	SpendPct    float64 `json:"spend_pct"`
	TokenPct    float64 `json:"token_pct"`
}

// planView renders the web UI Plan model.
func planView(p models.Plan, keysAssigned int, keyUsage []planKeyUsage) fiber.Map {
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
		"rpm":              limitView(p.RPM),
		"tpm":              limitView(p.TPM),
		"concurrent":       limitView(p.Concurrent),
		"allowed_models":   allowedModels,
		"keys_assigned":    keysAssigned,
		"key_usage":        keyUsage,
		"alert_at_percent": p.AlertPct,
		"period":           p.Period,
		"created_at":       p.CreatedAt,
	}
}

// limitView hides zero limits: the PATCH body expresses "clear this limit" as
// 0 (a JSON null pointer means "keep the stored value"), so the view renders 0
// the same as NULL — the dashboard's "Unlimited".
func limitView(v *int) any {
	if v == nil || *v == 0 {
		return nil
	}
	return *v
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

	// Plan caps apply to each key on its own, so usage is reported per key.
	keys, _, err := h.app.Repos.APIKeys.List(c.Context(), 0, -1)
	if err != nil {
		return err
	}
	byPlan := map[string][]repositories.APIKeyWithPlan{}
	for _, k := range keys {
		if k.PlanID != nil {
			byPlan[*k.PlanID] = append(byPlan[*k.PlanID], k)
		}
	}

	now := time.Now()
	out := make([]fiber.Map, 0, len(plans))
	for _, p := range plans {
		usage := []planKeyUsage{}
		if p.LimitMicros > 0 || p.LimitTokens > 0 {
			_, from := period.Window(p.Period, now)
			// ponytail: one sum per assigned key; fine for dozens of keys,
			// group the query by api_key_id if plans hold hundreds.
			for _, k := range byPlan[p.ID] {
				spent, err := h.app.Repos.Usage.SumSince(c.Context(), models.ScopeAPIKey, k.ID, from)
				if err != nil {
					return err
				}
				usage = append(usage, planKeyUsage{
					ID:          k.ID,
					Name:        k.Name,
					SpentMicros: spent.CostMicros,
					SpentTokens: spent.BudgetTokens,
					SpendPct:    percentOf(spent.CostMicros, p.LimitMicros),
					TokenPct:    percentOf(spent.BudgetTokens, p.LimitTokens),
				})
			}
		}
		out = append(out, planView(p, counts[p.ID], usage))
	}
	return dtos.List(c, out, dtos.TotalMeta(len(plans)))
}

// planFromRequest converts a Plan DTO into the stored model.
func planFromRequest(req dtos.Plan) models.Plan {
	plan := models.Plan{
		Name:        req.Name,
		Description: req.Description,
		Period:      cmp.Or(req.Period, "monthly"),
		RPM:         req.RPM,
		TPM:         req.TPM,
		Concurrent:  req.Concurrent,
	}
	if req.AllowedModels != nil {
		plan.AllowedModels = *req.AllowedModels
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

// applyPlanPatch overlays the fields the request actually supplied onto the
// stored plan. The dashboard PATCHes single fields, so writing a freshly
// built model would reset every omitted field — clearing allowed_models to
// "unrestricted" and dropping the rate limits.
func applyPlanPatch(plan *models.Plan, req dtos.Plan) {
	if req.Name != "" {
		plan.Name = req.Name
	}
	if req.Description != "" {
		plan.Description = req.Description
	}
	if req.Period != "" {
		plan.Period = req.Period
	}
	if req.AllowedModels != nil {
		plan.AllowedModels = *req.AllowedModels
	}
	if req.RPM != nil {
		plan.RPM = req.RPM
	}
	if req.TPM != nil {
		plan.TPM = req.TPM
	}
	if req.Concurrent != nil {
		plan.Concurrent = req.Concurrent
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
}

func (h *plansHandler) Store(c fiber.Ctx) error {
	var req dtos.Plan
	if err := lib.ValidateRequestBody(c, &req); err != nil {
		return err
	}

	plan := planFromRequest(req)
	plan.ID = uuid.NewString()
	plan.Name = cmp.Or(req.Name, "Plan")
	if err := h.app.Repos.Plans.Insert(c.Context(), plan); err != nil {
		return err
	}
	auditRecord(c.Context(), h.app, actorFrom(c), "plan.create", plan.ID, map[string]string{"name": plan.Name})
	return dtos.Created(c, planView(plan, 0, []planKeyUsage{}), "Plan created")
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

	plan, err := h.app.Repos.Plans.Get(c.Context(), id.String())
	if err != nil {
		return err
	}
	applyPlanPatch(&plan, req)
	if err := h.app.Repos.Plans.Update(c.Context(), plan); err != nil {
		return err
	}
	auditRecord(c.Context(), h.app, actorFrom(c), "plan.update", plan.ID, nil)

	updated, err := h.app.Repos.Plans.Get(c.Context(), plan.ID)
	if err != nil {
		return err
	}
	return dtos.OK(c, planView(updated, 0, []planKeyUsage{}))
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
