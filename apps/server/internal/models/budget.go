package models

import "time"

// Budget enforces a spend and/or token limit over a period.
type Budget struct {
	ID              string      `json:"id"`
	ScopeKind       BudgetScope `json:"scope_kind"`
	ScopeID         string      `json:"scope_id"`
	LimitMicros     int64       `json:"limit_micros"`
	LimitTokens     int64       `json:"limit_tokens"`
	Period          string      `json:"period"`
	AlertPct        int         `json:"alert_pct"`
	HardCutoff      bool        `json:"hard_cutoff"`
	RemainingTokens int64       `json:"remaining_tokens"`
	RemainingMicros int64       `json:"remaining_micros"`
	PeriodBucket    string      `json:"period_bucket"`
	CreatedAt       time.Time   `json:"created_at"`
	UpdatedAt       time.Time   `json:"updated_at"`
}
