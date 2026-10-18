package models

import "time"

// IPBlock is a client address or CIDR range refused by the server. A nil
// ExpiresAt is a permanent, manually added block.
type IPBlock struct {
	ID        string     `json:"id"`
	CIDR      string     `json:"cidr"`
	Reason    string     `json:"reason"`
	ExpiresAt *time.Time `json:"expires_at"`
	CreatedAt time.Time  `json:"created_at"`
}
