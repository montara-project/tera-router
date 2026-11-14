package dtos

import (
	"time"

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
	// 9e12 USD is well past any real budget and still converts to micros
	// without overflowing int64; a negative or overflowing limit would
	// silently store the "no cap" encoding.
	v.Field("budget_spend").Range(0, 9e12)
	v.Field("limit_tokens").Range(0, 9e18)
	v.Field("alert_pct").Range(0, 100)
}

// BudgetStatus is one row of the budgets/status endpoint: the budget plus
// its spend over the current period.
type BudgetStatus struct {
	models.Budget
	// ScopeName is the readable name of what the budget caps: the API key's
	// name or the account's "provider · label". Empty for the whole instance
	// and for a scope that no longer exists.
	ScopeName   string  `json:"scope_name"`
	SpentMicros int64   `json:"spent_micros"`
	SpentTokens int64   `json:"spent_tokens"`
	SpendPct    float64 `json:"spend_pct"`
	TokenPct    float64 `json:"token_pct"`
	// ResetsAt is when the current period ends and spend starts from zero.
	ResetsAt time.Time `json:"resets_at"`
}
