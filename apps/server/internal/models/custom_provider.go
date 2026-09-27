package models

import "time"

// CustomProvider is an operator-registered [OI]-compatible upstream.
type CustomProvider struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Slug      string    `json:"slug"`
	BaseURL   string    `json:"base_url"`
	APIKind   string    `json:"api_kind"`
	Pricing   string    `json:"pricing"` // raw JSON
	Enabled   bool      `json:"enabled"`
	Priority  int       `json:"priority"`
	Metadata  string    `json:"metadata"` // raw JSON
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// TableName returns the backing table for the model.
func (CustomProvider) TableName() string { return "custom_providers" }
