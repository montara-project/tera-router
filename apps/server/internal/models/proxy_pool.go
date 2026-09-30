package models

import "time"

// ProxyPool is an outbound proxy definition.
type ProxyPool struct {
	ID           string     `json:"id"`
	Name         string     `json:"name"`
	URL          string     `json:"url"`
	Mode         string     `json:"mode"`
	Label        string     `json:"label"`
	Status       string     `json:"status"`
	LastTestedAt *time.Time `json:"last_tested_at"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
}
