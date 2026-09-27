package models

import "time"

type Chain struct {
	ID               string      `json:"id"`
	Name             string      `json:"name"`
	Strategy         string      `json:"strategy"`
	FallbackProvider string      `json:"fallback_provider"`
	FallbackModel    string      `json:"fallback_model"`
	ContextWindow    int         `json:"context_window"`
	Enabled          bool        `json:"enabled"`
	Steps            []ChainStep `json:"steps"`
	CreatedAt        time.Time   `json:"created_at"`
	UpdatedAt        time.Time   `json:"updated_at"`
}

// TableName returns the backing table for the model.
func (Chain) TableName() string { return "chains" }
