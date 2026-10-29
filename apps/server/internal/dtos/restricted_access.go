package dtos

import (
	"tera-router/server/internal/lib/validator"
	"tera-router/server/internal/models"
)

// RestrictedAccess is the restricted access body (PUT /v1/restricted-access).
// Formats are checked by ipblock.CompileRestriction.
type RestrictedAccess struct {
	models.RestrictedAccess
}

func (d *RestrictedAccess) Validate(v *validator.MapValidator) {
	v.Field("enabled").Required()
	v.Field("start_date").String()
	v.Field("end_date").String()
	v.Field("start_time").String()
	v.Field("end_time").String()
	v.Field("timezone").String()
}
