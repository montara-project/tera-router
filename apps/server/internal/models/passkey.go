package models

import "time"

// Passkey is a WebAuthn credential that signs its owner in to the dashboard.
// Credential is the go-webauthn credential record as JSON and never leaves
// the server.
type Passkey struct {
	ID           string     `json:"id"`
	UserID       string     `json:"user_id"`
	CredentialID string     `json:"-"`
	RPID         string     `json:"rp_id"`
	Name         string     `json:"name"`
	Credential   string     `json:"-"`
	LastUsedAt   *time.Time `json:"last_used_at"`
	CreatedAt    time.Time  `json:"created_at"`
}
