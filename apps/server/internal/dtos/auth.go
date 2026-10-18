package dtos

import (
	"time"

	"tera-router/server/internal/lib/validator"
	"tera-router/server/internal/models"
)

// SignIn is the sign-in request body (POST /v1/auth/sign-in).
type SignIn struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	// OTP is the authenticator code, required once the user enables TOTP.
	OTP string `json:"otp"`
}

func (d *SignIn) Validate(v *validator.MapValidator) {
	v.Field("email").Required().Email()
	v.Field("password").Required().String()
}

// TOTPEnable confirms enrollment (POST /v1/auth/totp/enable): the secret from
// /totp/setup plus a code the authenticator app generated from it.
type TOTPEnable struct {
	Secret string `json:"secret"`
	Code   string `json:"code"`
}

func (d *TOTPEnable) Validate(v *validator.MapValidator) {
	v.Field("secret").Required().String()
	v.Field("code").Required().String()
}

// TOTPDisable turns TOTP off (POST /v1/auth/totp/disable); a current code
// proves the caller still holds the authenticator.
type TOTPDisable struct {
	Code string `json:"code"`
}

func (d *TOTPDisable) Validate(v *validator.MapValidator) {
	v.Field("code").Required().String()
}

// Refresh is the token rotation request body (POST /v1/auth/refresh).
type Refresh struct {
	RefreshToken string `json:"refresh_token"`
}

func (d *Refresh) Validate(v *validator.MapValidator) {
	v.Field("refresh_token").Required().String()
}

// Session is the sign-in result: the user plus freshly issued tokens. It is
// internal to the handler and never serialized as-is; sessionView renders the
// wire shape from it.
type Session struct {
	User   models.User `json:"-"`
	Tokens TokenPair   `json:"-"`
}

// TokenPair carries the three tokens the web client stores.
type TokenPair struct {
	AccessToken  string    `json:"access_token"`
	RefreshToken string    `json:"refresh_token"`
	IDToken      string    `json:"id_token"`
	ExpiresAt    time.Time `json:"expires_at"`
	ExpiresIn    int       `json:"expires_in"`
}
