package models

import "time"

// Account holds an upstream provider credential. Secret material is stored
// as envelope-encrypted blobs; plaintext is never persisted.
type Account struct {
	ID             string     `json:"id"`
	Provider       string     `json:"provider"`
	Label          string     `json:"label"`
	AuthKind       AuthKind   `json:"auth_kind"`
	Secret         Sealed     `json:"-"`
	KeyFingerprint string     `json:"key_fingerprint"`
	KeyHash        string     `json:"-"`
	Token          Sealed     `json:"-"`
	Refresh        Sealed     `json:"-"`
	TokenExpiresAt *time.Time `json:"token_expires_at"`
	Metadata       string     `json:"metadata"` // raw JSON
	Priority       int        `json:"priority"`
	Disabled       bool       `json:"disabled"`
	ProxyPoolID    *string    `json:"proxy_pool_id"`
	NeedsReconnect bool       `json:"needs_reconnect"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
}

// TableName returns the backing table for the model.
func (Account) TableName() string { return "accounts" }
