package models

// AuthKind classifies how an account authenticates upstream.
type AuthKind string

const (
	AuthAPIKey AuthKind = "api_key"
	AuthOAuth  AuthKind = "oauth"
	AuthNone   AuthKind = "none"
)
