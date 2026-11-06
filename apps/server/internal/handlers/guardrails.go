package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"strings"

	"tera-router/server/internal/app"
	"tera-router/server/internal/dtos"
	"tera-router/server/internal/guardrails"
	"tera-router/server/internal/lib"
	"tera-router/server/internal/lib/apperr"
	"tera-router/server/internal/models"
	"tera-router/server/internal/repositories"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
)

const (
	guardrailsSettingsKey   = "guardrails"
	guardrailsDecisionLimit = 100
)

type guardrailsHandler struct {
	app *app.Application
}

// loadGuardrailsSettings reads the toggle, defaulting to enabled.
func loadGuardrailsSettings(ctx context.Context, a *app.Application) (dtos.GuardrailsSettings, error) {
	raw, err := a.Repos.Settings.Get(ctx, guardrailsSettingsKey)
	if errors.Is(err, apperr.ErrNotFound) {
		return dtos.GuardrailsSettings{ExternalDetectors: true}, nil
	}
	if err != nil {
		return dtos.GuardrailsSettings{}, err
	}
	var settings dtos.GuardrailsSettings
	if err := json.Unmarshal([]byte(raw), &settings); err != nil {
		return dtos.GuardrailsSettings{ExternalDetectors: true}, nil
	}
	return settings, nil
}

// policyView renders a stored policy in the dashboard shape: protections
// and config parsed back out of their raw JSON columns.
func policyView(p models.GuardrailPolicy) fiber.Map {
	protections := json.RawMessage(p.Protections)
	if len(protections) == 0 {
		protections = json.RawMessage("[]")
	}
	config := json.RawMessage(p.Config)
	if len(config) == 0 {
		config = json.RawMessage("{}")
	}

	var target any
	if p.Target != "" {
		target = p.Target
	}

	return fiber.Map{
		"id":          p.ID,
		"name":        p.Name,
		"enabled":     p.Enabled,
		"scope":       p.Scope,
		"target":      target,
		"protections": protections,
		"config":      config,
	}
}

func (h *guardrailsHandler) Overview(c fiber.Ctx) error {
	policies, err := h.app.Repos.Guardrails.List(c.Context())
	if err != nil {
		return err
	}

	rows, err := h.app.Repos.Guardrails.AuditRows(c.Context(), guardrailsDecisionLimit)
	if err != nil {
		return err
	}

	settings, err := loadGuardrailsSettings(c.Context(), h.app)
	if err != nil {
		return err
	}

	views := []fiber.Map{}
	for _, policy := range policies {
		views = append(views, policyView(policy))
	}

	return dtos.OK(c, fiber.Map{
		"external_detectors": settings.ExternalDetectors,
		"policies":           views,
		"decisions":          decisionViews(rows),
	})
}

// guardrailDecisionDetail is the JSON the gateway stores on a decision's
// audit row.
type guardrailDecisionDetail struct {
	Detectors  []string `json:"detectors"`
	Entities   []string `json:"entities"`
	Reasons    []string `json:"reasons"`
	OverheadMS int64    `json:"overhead_ms"`
	KeyID      string   `json:"key_id"`
	Chain      string   `json:"chain"`
	RequestID  string   `json:"request_id"`
}

// decisionViews renders the gateway's audit rows as the dashboard's decision
// list: the action's suffix is the decision, everything else comes from the
// detail JSON the gateway wrote.
func decisionViews(rows []repositories.GuardrailDecisionRow) []dtos.GuardrailDecision {
	out := make([]dtos.GuardrailDecision, 0, len(rows))
	for _, row := range rows {
		var detail guardrailDecisionDetail
		_ = json.Unmarshal([]byte(row.Detail), &detail)

		out = append(out, dtos.GuardrailDecision{
			ID:         row.ID,
			Time:       row.CreatedAt.UTC().Format("2006-01-02 15:04:05"),
			Actor:      row.Actor,
			Decision:   strings.TrimPrefix(row.Action, "guardrail."),
			Detectors:  stringsOrEmpty(detail.Detectors),
			Entities:   stringsOrEmpty(detail.Entities),
			Reasons:    stringsOrEmpty(detail.Reasons),
			KeyID:      detail.KeyID,
			KeyName:    strings.TrimPrefix(row.Actor, "key:"),
			Model:      row.Target,
			Chain:      detail.Chain,
			RequestID:  detail.RequestID,
			OverheadMS: detail.OverheadMS,
		})
	}
	return out
}

// stringsOrEmpty keeps a JSON list non-null so the dashboard never has to
// coalesce it.
func stringsOrEmpty(values []string) []string {
	if values == nil {
		return []string{}
	}
	return values
}

// Store creates a guardrail policy.
func (h *guardrailsHandler) Store(c fiber.Ctx) error {
	var req dtos.GuardrailPolicyRequest
	if err := lib.ValidateRequestBody(c, &req); err != nil {
		return err
	}

	policy := policyFromRequest(req)
	policy.ID = uuid.NewString()
	if err := h.app.Repos.Guardrails.Insert(c.Context(), policy); err != nil {
		return err
	}
	auditRecord(c, actorFrom(c), "guardrail.policy.create", policy.ID,
		map[string]string{"name": policy.Name, "scope": policy.Scope})
	return dtos.Created(c, policyView(policy), "Policy created")
}

// Update replaces a guardrail policy (full-body PATCH/PUT).
func (h *guardrailsHandler) Update(c fiber.Ctx) error {
	id, err := lib.ContextParamUUID(c, "id")
	if err != nil {
		return apperr.ErrBadRequest
	}

	var req dtos.GuardrailPolicyRequest
	if err := lib.ValidateRequestBody(c, &req); err != nil {
		return err
	}

	policy := policyFromRequest(req)
	policy.ID = id.String()
	if err := h.app.Repos.Guardrails.Update(c.Context(), policy); err != nil {
		return err
	}
	auditRecord(c, actorFrom(c), "guardrail.policy.update", policy.ID,
		map[string]string{"name": policy.Name, "scope": policy.Scope})
	return dtos.OK(c, policyView(policy))
}

// Delete removes a guardrail policy.
func (h *guardrailsHandler) Delete(c fiber.Ctx) error {
	id, err := lib.ContextParamUUID(c, "id")
	if err != nil {
		return apperr.ErrBadRequest
	}

	if err := h.app.Repos.Guardrails.Delete(c.Context(), id.String()); err != nil {
		return err
	}
	auditRecord(c, actorFrom(c), "guardrail.policy.delete", id.String(), nil)
	return dtos.Deleted(c, "Policy deleted")
}

// UpdateSettings replaces the tenant-wide guardrails toggle.
func (h *guardrailsHandler) UpdateSettings(c fiber.Ctx) error {
	var req dtos.GuardrailsSettingsRequest
	if err := lib.ValidateRequestBody(c, &req); err != nil {
		return err
	}

	settings := dtos.GuardrailsSettings{ExternalDetectors: *req.ExternalDetectors}
	raw, err := json.Marshal(settings)
	if err != nil {
		return err
	}
	if err := h.app.Repos.Settings.Upsert(c.Context(), guardrailsSettingsKey, string(raw)); err != nil {
		return err
	}
	auditRecord(c, actorFrom(c), "guardrail.settings.update", guardrailsSettingsKey, settings)
	return dtos.OK(c, settings)
}

// Evaluate dry-runs the sample text against a detector config (or, when no
// config is posted, against every enabled policy merged most specific first).
func (h *guardrailsHandler) Evaluate(c fiber.Ctx) error {
	var req dtos.EvaluateRequest
	if err := lib.ValidateRequestBody(c, &req); err != nil {
		return err
	}

	settings, err := loadGuardrailsSettings(c.Context(), h.app)
	if err != nil {
		return err
	}

	cfg := guardrails.Config{}
	if len(req.Config) > 0 && string(req.Config) != "null" {
		if err := json.Unmarshal(req.Config, &cfg); err != nil {
			return dtos.Message(c, fiber.StatusBadRequest, "Invalid detector config")
		}
	} else {
		policies, err := h.app.Repos.Guardrails.ListEnabled(c.Context())
		if err != nil {
			return err
		}
		cfg = guardrails.Merge(policies)
	}

	result := guardrails.Evaluate(cfg, settings.ExternalDetectors, req.Text)
	return dtos.OK(c, result)
}

// policyFromRequest maps the request body onto the stored model. Enabled
// defaults to true on create; protections and config round-trip as raw JSON.
func policyFromRequest(req dtos.GuardrailPolicyRequest) models.GuardrailPolicy {
	enabled := true
	if req.Enabled != nil {
		enabled = *req.Enabled
	}

	protections := "[]"
	if len(req.Protections) > 0 {
		if raw, err := json.Marshal(req.Protections); err == nil {
			protections = string(raw)
		}
	}

	config := "{}"
	if len(req.Config) > 0 && string(req.Config) != "null" {
		config = string(req.Config)
	}

	return models.GuardrailPolicy{
		Name:        req.Name,
		Scope:       req.Scope,
		Target:      req.Target,
		Protections: protections,
		Config:      config,
		Enabled:     enabled,
	}
}
