package dtos

import (
	"encoding/json"
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

// TOTPEnable confirms enrollment (POST /v1/auth/totp/enable): the account
// password, the secret from /totp/setup and a code the authenticator app
// generated from it.
type TOTPEnable struct {
	Password string `json:"password"`
	Secret   string `json:"secret"`
	Code     string `json:"code"`
}

func (d *TOTPEnable) Validate(v *validator.MapValidator) {
	v.Field("password").Required().String()
	v.Field("secret").Required().String()
	v.Field("code").Required().String()
}

// TOTPDisable turns TOTP off (POST /v1/auth/totp/disable): the account
// password plus a current code, which proves the caller still holds the
// authenticator.
type TOTPDisable struct {
	Password string `json:"password"`
	Code     string `json:"code"`
}

func (d *TOTPDisable) Validate(v *validator.MapValidator) {
	v.Field("password").Required().String()
	v.Field("code").Required().String()
}

// Reauth re-authenticates an action that exposes secrets (key reveal, backup
// download and export): the signed-in user's password, plus the
// authenticator code once the server answers totp_required.
type Reauth struct {
	Password string `json:"password"`
	OTP      string `json:"otp"`
}

func (d *Reauth) Validate(v *validator.MapValidator) {
	v.Field("password").Required().String()
}

// PasskeyFinish completes a passkey ceremony: the id the begin step returned
// and the browser's PublicKeyCredential.toJSON() output. Name labels a new
// passkey and is ignored on sign-in.
type PasskeyFinish struct {
	CeremonyID string          `json:"ceremony_id"`
	Name       string          `json:"name"`
	Credential json.RawMessage `json:"credential"`
}

func (d *PasskeyFinish) Validate(v *validator.MapValidator) {
	v.Field("ceremony_id").Required().String()
	v.Field("name").String()
	v.Field("credential").Required()
}

// OIDCExchange redeems the one-time ticket the OIDC callback appended to its
// dashboard redirect for the session it opened (POST /v1/auth/oidc/exchange).
type OIDCExchange struct {
	Ticket string `json:"ticket"`
}

func (d *OIDCExchange) Validate(v *validator.MapValidator) {
	v.Field("ticket").Required().String()
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
	// SessionID is the session's refresh token row id (the access token jti).
	SessionID string `json:"-"`
}

// TokenPair carries the three tokens the web client stores.
type TokenPair struct {
	AccessToken  string    `json:"access_token"`
	RefreshToken string    `json:"refresh_token"`
	IDToken      string    `json:"id_token"`
	ExpiresAt    time.Time `json:"expires_at"`
	ExpiresIn    int       `json:"expires_in"`
}
