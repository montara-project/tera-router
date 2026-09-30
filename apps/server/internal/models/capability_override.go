package models

import "time"

// CapabilityOverride forces the capability set for a provider/model pair.
type CapabilityOverride struct {
	ID           string    `json:"id"`
	Provider     string    `json:"provider"`
	Model        string    `json:"model"`
	Capabilities []string  `json:"capabilities"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}
