package models

import "time"

// ChainStep is one candidate target within a chain.
type ChainStep struct {
	ID       string `json:"id"`
	ChainID  string `json:"chain_id"`
	Position int    `json:"position"`
	Provider string `json:"provider"`
	Model    string `json:"model"`
	// Active false keeps the step in the chain but the gateway skips it.
	Active    bool      `json:"active"`
	CreatedAt time.Time `json:"created_at"`
}
