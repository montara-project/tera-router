package models

import "time"

// ProxyPool is an outbound proxy definition.
type ProxyPool struct {
	ID     string `json:"id"`
	Name   string `json:"name"`
	URL    string `json:"url"`
	Mode   string `json:"mode"`
	Label  string `json:"label"`
	Status string `json:"status"`
	// Bypass lists hosts (comma separated) that connect directly; a leading
	// dot matches subdomains.
	Bypass string `json:"bypass"`
	// Disabled pools are skipped: bound accounts connect directly.
	Disabled bool `json:"disabled"`
	// Strict fails the account instead of connecting directly when the pool
	// is unreachable.
	Strict       bool       `json:"strict"`
	LastTestedAt *time.Time `json:"last_tested_at"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
}
