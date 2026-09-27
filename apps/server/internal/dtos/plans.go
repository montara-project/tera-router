package dtos

import "tera-router/server/internal/lib/validator"

// Plan is the plan create/update request body (POST/PUT/PATCH /v1/plans).
type Plan struct {
	Name          string   `json:"name"`
	Description   string   `json:"description"`
	BudgetSpend   *float64 `json:"budgetSpend"` // USD; stored as micros
	BudgetTokens  *int64   `json:"budgetTokens"`
	Period        string   `json:"period"`
	AlertPct      *int     `json:"alertAtPercent"`
	HardCutoff    *bool    `json:"hardCutoff"`
	AllowedModels []string `json:"allowedModels"`
	RPM           *int     `json:"rpm"`
	TPM           *int     `json:"tpm"`
	Concurrent    *int     `json:"concurrent"`
}

func (d *Plan) Validate(v *validator.MapValidator) {
	v.Field("name").String()
	v.Field("period").WithinS("daily", "weekly", "monthly")
}
