package dtos

import "tera-router/server/internal/lib/validator"

// CustomProvider is the OpenAI-compatible upstream registration body
// (POST/PUT/PATCH /v1/custom-providers).
type CustomProvider struct {
	Name     string         `json:"name"`
	Slug     string         `json:"slug"`
	BaseURL  string         `json:"base_url"`
	APIKind  string         `json:"api_kind"`
	Pricing  map[string]any `json:"pricing"`
	Enabled  *bool          `json:"enabled"`
	Priority int            `json:"priority"`
	Metadata map[string]any `json:"metadata"`
}

func (d *CustomProvider) Validate(v *validator.MapValidator) {
	v.Field("name").Required().String()
}
