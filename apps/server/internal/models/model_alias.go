package models

import "time"

// ModelAlias is a model alias pool: one bare name mapping to an ordered list
// of provider/model targets.
type ModelAlias struct {
	ID            string        `json:"id"`
	Name          string        `json:"name"`
	ContextWindow int           `json:"context_window"`
	Active        bool          `json:"active"`
	Targets       []AliasTarget `json:"targets"`
	CreatedAt     time.Time     `json:"created_at"`
	UpdatedAt     time.Time     `json:"updated_at"`
}

// TableName returns the backing table for the model.
func (ModelAlias) TableName() string { return "model_aliases" }
