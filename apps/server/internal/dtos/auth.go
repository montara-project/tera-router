package dtos

import "tera-router/server/internal/lib/validator"

// SignIn is the sign-in request body (POST /v1/auth/sign-in).
type SignIn struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

func (d *SignIn) Validate(v *validator.MapValidator) {
	v.Field("email").Required().Email()
	v.Field("password").Required().String()
}

// Refresh is the token rotation request body (POST /v1/auth/refresh).
type Refresh struct {
	RefreshToken string `json:"refresh_token"`
}

func (d *Refresh) Validate(v *validator.MapValidator) {
	v.Field("refresh_token").Required().String()
}
