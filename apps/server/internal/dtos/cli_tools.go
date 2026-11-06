package dtos

import "tera-router/server/internal/lib/validator"

// ApplyCLITool is the body of POST /v1/cli-tools/:id/apply. Exactly one of
// KeyName (create a dedicated key with this name) or APIKey (a full key the
// user pasted) is set.
type ApplyCLITool struct {
	BaseURL string `json:"base_url"`
	Model   string `json:"model"`
	KeyName string `json:"key_name"`
	APIKey  string `json:"api_key"`
}

func (d *ApplyCLITool) Validate(v *validator.MapValidator) {
	v.Field("base_url").Required().String()
	v.Field("model").String()
	v.Field("key_name").String()
	v.Field("api_key").String()
}
