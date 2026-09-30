package dtos

import "tera-router/server/internal/lib/validator"

// OAuthAuthorize is the request body of POST /v1/oauth/:provider/authorize.
type OAuthAuthorize struct {
	// RedirectURI is the dashboard callback the provider should redirect back
	// to. Fixed-loopback providers (codex) resolve it to their own
	// localhost:1455/1457 listener instead.
	RedirectURI string `json:"redirect_uri"`
}

func (d *OAuthAuthorize) Validate(v *validator.MapValidator) {
	v.Field("redirect_uri").Required().String()
}

// OAuthExchange is the request body of POST /v1/oauth/:provider/exchange. The
// code may carry Claude's trailing "#state" fragment when pasted.
type OAuthExchange struct {
	Code  string `json:"code"`
	State string `json:"state"`
	Label string `json:"label"`
}

func (d *OAuthExchange) Validate(v *validator.MapValidator) {
	v.Field("code").Required().String()
	v.Field("state").Required().String()
}
