package models

import "time"

// ChainStep is one candidate target within a chain.
type ChainStep struct {
	ID        string    `json:"id"`
	ChainID   string    `json:"chain_id"`
	Position  int       `json:"position"`
	Provider  string    `json:"provider"`
	Model     string    `json:"model"`
	CreatedAt time.Time `json:"created_at"`
}

// TableName returns the backing table for the model.
func (ChainStep) TableName() string { return "chain_steps" }
