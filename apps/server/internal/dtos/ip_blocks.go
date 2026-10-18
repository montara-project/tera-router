package dtos

import "tera-router/server/internal/lib/validator"

// IPBlock is the manual block body (POST /v1/ip-blocks).
type IPBlock struct {
	CIDR   string `json:"cidr"`
	Reason string `json:"reason"`
}

func (d *IPBlock) Validate(v *validator.MapValidator) {
	v.Field("cidr").Required().String()
}
