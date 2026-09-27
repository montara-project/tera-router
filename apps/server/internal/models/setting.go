package models

import "time"

// Setting is one settings kv row; Value is raw JSON.
type Setting struct {
	Key       string    `json:"key"`
	Value     string    `json:"value"` // raw JSON
	UpdatedAt time.Time `json:"updated_at"`
}

// TableName returns the backing table for the model.
func (Setting) TableName() string { return "settings" }
