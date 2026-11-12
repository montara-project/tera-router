package dtos

import "tera-router/server/internal/lib/validator"

// Plan is the plan create/update request body (POST/PATCH /v1/plans).
type Plan struct {
	Name         string   `json:"name"`
	Description  string   `json:"description"`
	BudgetSpend  *float64 `json:"budget_spend"` // USD; stored as micros
	BudgetTokens *int64   `json:"budget_tokens"`
	Period       string   `json:"period"`
	AlertPct     *int     `json:"alert_at_percent"`
	HardCutoff   *bool    `json:"hard_cutoff"`
	// Pointer so an update can tell "field omitted" (keep the stored list)
	// from "explicitly empty" (clear the restriction).
	AllowedModels *[]string `json:"allowed_models"`
	RPM           *int      `json:"rpm"`
	TPM           *int      `json:"tpm"`
	Concurrent    *int      `json:"concurrent"`
}

func (d *Plan) Validate(v *validator.MapValidator) {
	v.Field("name").String()
	v.Field("period").WithinS("daily", "weekly", "monthly")
	// Same bounds as budgets: a negative or int64-overflowing spend limit
	// silently means "no cap" everywhere it is read.
	v.Field("budget_spend").Range(0, 9e12)
	v.Field("budget_tokens").Range(0, 9e18)
	v.Field("alert_at_percent").Range(0, 100)
	v.Field("rpm").Range(0, 1e9)
	v.Field("tpm").Range(0, 1e9)
	v.Field("concurrent").Range(0, 1e9)
}
