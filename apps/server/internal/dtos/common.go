package dtos

import "tera-router/server/internal/lib/validator"

// ListQuery is the shared pagination binding for list endpoints.
// Offset starts at 0; limit is clamped to 100 unless the endpoint raises it.
type ListQuery struct {
	Offset int `query:"offset"`
	Limit  int `query:"limit"`
}

// Validate declares rules over the raw query map: every parameter is a
// string and optional, but when present it must be well formed.
func (dto ListQuery) Validate(v *validator.MapValidator) {
	v.Field("offset").Regex(`^\d+$`)
	v.Field("limit").Regex(`^\d+$`)
}

const (
	defaultListLimit = 10
	maxListLimit     = 100
)

// Clamp normalizes pagination values: a missing or zero limit falls back to
// 10 and the limit never exceeds 100.
func (dto *ListQuery) Clamp() {
	dto.ClampTo(maxListLimit)
}

// ClampTo is Clamp with the endpoint's own ceiling, for a list the dashboard
// has to read whole (a provider's accounts) rather than page by page.
func (dto *ListQuery) ClampTo(maxLimit int) {
	if dto.Limit <= 0 {
		dto.Limit = defaultListLimit
	}
	if dto.Limit > maxLimit {
		dto.Limit = maxLimit
	}
	if dto.Offset < 0 {
		dto.Offset = 0
	}
}
