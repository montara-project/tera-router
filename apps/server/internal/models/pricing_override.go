package models

import "time"

// PricingOverride sets per-provider/model rates in micros (millionths of a
// dollar per million tokens).
type PricingOverride struct {
	ID               string `json:"id"`
	Provider         string `json:"provider"`
	Model            string `json:"model"`
	InputMicros      int64  `json:"input_micros"`
	OutputMicros     int64  `json:"output_micros"`
	CacheReadMicros  int64  `json:"cache_read_micros"`
	CacheWriteMicros int64  `json:"cache_write_micros"`
	// ReasoningMicros prices the reasoning tokens upstreams report inside
	// their completion count. Zero bills the whole completion at
	// OutputMicros.
	ReasoningMicros int64 `json:"reasoning_micros"`
	// TokenConsumptionRate scales how fast requests on this model drain token
	// budgets: nil = no override (1:1), 0 = drains nothing, > 1 amplifies.
	// Cost accounting is never scaled. Nil rather than a plain float so an
	// explicit 0 (free) stays distinguishable from "not set".
	TokenConsumptionRate *float64  `json:"token_consumption_rate"`
	CreatedAt            time.Time `json:"created_at"`
	UpdatedAt            time.Time `json:"updated_at"`
}
