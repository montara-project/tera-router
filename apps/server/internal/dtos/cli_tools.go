package dtos

import "tera-router/server/internal/lib/validator"

// ApplyClaudeCode is the Claude Code wiring request body
// (POST /v1/cli-tools/claude-code/apply). The key is referenced by id; the
// server decrypts its plaintext itself so the credential never round-trips
// through the browser.
type ApplyClaudeCode struct {
	BaseURL string `json:"base_url"`
	KeyID   string `json:"key_id"`
	Model   string `json:"model"`
}

func (d *ApplyClaudeCode) Validate(v *validator.MapValidator) {
	v.Field("base_url").Required().String()
	v.Field("key_id").Required().String()
	v.Field("model").String()
}
