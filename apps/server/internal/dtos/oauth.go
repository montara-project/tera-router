package dtos

import "tera-router/server/internal/lib/validator"

// OAuthExchange is the request body of POST /v1/oauth/:provider/exchange. The
// code may carry the provider's trailing "#state" fragment when pasted.
type OAuthExchange struct {
	Code  string `json:"code"`
	State string `json:"state"`
}

func (d *OAuthExchange) Validate(v *validator.MapValidator) {
	v.Field("code").Required().String()
	v.Field("state").Required().String()
}
