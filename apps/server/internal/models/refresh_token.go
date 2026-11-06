package models

import "time"

// RefreshToken stores only the sha-256 hash of the opaque refresh token. One
// row is one sign-in session: refreshing rotates the hash in place, so the id
// stays stable and access tokens carry it as their session id (jti).
type RefreshToken struct {
	ID        string     `json:"id"`
	UserID    string     `json:"user_id"`
	TokenHash string     `json:"-"`
	UserAgent string     `json:"user_agent"`
	IPAddress string     `json:"ip_address"`
	ExpiresAt time.Time  `json:"expires_at"`
	RevokedAt *time.Time `json:"revoked_at"`
	CreatedAt time.Time  `json:"created_at"`
}
