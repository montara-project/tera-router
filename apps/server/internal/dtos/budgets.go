package dtos

import (
	"tera-router/server/internal/lib/validator"
	"tera-router/server/internal/models"
)

// Budget is the budget create/update request body
// (POST/PUT/PATCH /v1/budgets).
type Budget struct {
	ScopeKind   string   `json:"scope_kind"`
	ScopeID     string   `json:"scope_id"`
	BudgetSpend *float64 `json:"budget_spend"` // USD; stored as micros
	LimitTokens *int64   `json:"limit_tokens"`
	Period      string   `json:"period"`
	AlertPct    *int     `json:"alert_pct"`
	HardCutoff  *bool    `json:"hard_cutoff"`
}

func (d *Budget) Validate(v *validator.MapValidator) {
	v.Field("scope_kind").WithinS("tenant", "api_key", "account")
	v.Field("period").WithinS("daily", "weekly", "monthly")
}

// BudgetStatus is one row of the budgets/status endpoint: the budget plus
// its spend over the current period.
type BudgetStatus struct {
	models.Budget
	SpentMicros int64   `json:"spent_micros"`
	SpentTokens int64   `json:"spent_tokens"`
	SpendPct    float64 `json:"spend_pct"`
	TokenPct    float64 `json:"token_pct"`
}
