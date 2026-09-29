package dtos

import "tera-router/server/internal/lib/validator"

// CreateKey is the key minting request body (POST /v1/keys).
type CreateKey struct {
	Name          string    `json:"name"`
	PlanID        string    `json:"plan_id"`
	Scopes        string    `json:"scopes"`
	AllowedModels *[]string `json:"allowed_models"`
}

func (d *CreateKey) Validate(v *validator.MapValidator) {
	v.Field("name").Required().String()
}

// UpdateKey is the key mutation request body (PUT/PATCH /v1/keys/{id}).
// Pointer fields are optional: absent fields keep their stored values.
type UpdateKey struct {
	Name          string    `json:"name"`
	PlanID        *string   `json:"plan_id"`
	Scopes        *string   `json:"scopes"`
	Disabled      *bool     `json:"disabled"`
	AllowedModels *[]string `json:"allowed_models"`
}

func (d *UpdateKey) Validate(v *validator.MapValidator) {
	v.Field("name").String()
}
