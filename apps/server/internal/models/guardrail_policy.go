package models

import "time"

// GuardrailPolicy is one layered content-safety policy. Scope selects the
// layer (global, provider, model, chain, key) and Target narrows it to one
// identifier within that scope; Protections and Config are raw JSON so the
// dashboard can evolve detector options without schema churn.
type GuardrailPolicy struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Scope       string    `json:"scope"`
	Target      string    `json:"target"`
	Protections string    `json:"protections"` // raw JSON array of labels
	Config      string    `json:"config"`      // raw JSON detector config
	Enabled     bool      `json:"enabled"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}
