package models

import "time"

// Plan is a reusable template for budget limits and model restrictions.
type Plan struct {
	ID            string    `json:"id"`
	Name          string    `json:"name"`
	Description   string    `json:"description"`
	LimitMicros   int64     `json:"limit_micros"`
	LimitTokens   int64     `json:"limit_tokens"`
	Period        string    `json:"period"`
	AlertPct      int       `json:"alert_pct"`
	HardCutoff    bool      `json:"hard_cutoff"`
	AllowedModels []string  `json:"allowed_models"`
	RPM           *int      `json:"rpm"`
	TPM           *int      `json:"tpm"`
	Concurrent    *int      `json:"concurrent"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

// TableName returns the backing table for the model.
func (Plan) TableName() string { return "plans" }
