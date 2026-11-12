package models

import "time"

type User struct {
	ID           string     `json:"id"`
	Fullname     string     `json:"fullname"`
	Email        string     `json:"email"`
	Phone        *string    `json:"phone"`
	Address      *string    `json:"address"`
	TokenVerify  *string    `json:"token_verify"`
	PasswordHash string     `json:"-"`
	IsActive     bool       `json:"is_active"`
	IsBlocked    bool       `json:"is_blocked"`
	RoleID       string     `json:"role_id"`
	Role         Role       `json:"role"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
	DeletedAt    *time.Time `json:"deleted_at"`
	// TOTP second factor; the secret is sealed and never serialized.
	TOTPWrappedDEK string `json:"-"`
	TOTPCiphertext string `json:"-"`
	TOTPLastStep   int64  `json:"-"`
	TOTPEnabled    bool   `json:"totp_enabled"`
	// OIDCIss and OIDCSub are the linked identity provider's issuer and
	// subject claims — a sub is only unique within its issuer, so the pair
	// binds the account. "" means the account has no SSO identity bound.
	OIDCIss string `json:"-"`
	OIDCSub string `json:"-"`
	// SSOLinked reports whether an identity provider is bound; it drives the
	// reauthentication affordances an SSO-provisioned account needs, since
	// its password is an unknown random secret.
	SSOLinked bool `json:"sso_linked"`
}
