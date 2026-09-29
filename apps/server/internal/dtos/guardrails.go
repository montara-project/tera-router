package dtos

import (
	"encoding/json"

	"tera-router/server/internal/lib/validator"
)

// GuardrailPolicyRequest is the create/update body for a guardrail policy.
// Config travels as opaque JSON so the dashboard owns the detector shape.
type GuardrailPolicyRequest struct {
	Name        string          `json:"name"`
	Scope       string          `json:"scope"`
	Target      string          `json:"target"`
	Protections []string        `json:"protections"`
	Enabled     *bool           `json:"enabled"`
	Config      json.RawMessage `json:"config"`
}

// Validate enforces the dashboard contract: a name and a known scope.
func (d *GuardrailPolicyRequest) Validate(v *validator.MapValidator) {
	v.Field("name").Required().String()
	v.Field("scope").Required().WithinS("global", "provider", "model", "chain", "key")
}

// GuardrailsSettingsRequest is the body for the tenant-wide toggle.
type GuardrailsSettingsRequest struct {
	ExternalDetectors *bool `json:"external_detectors"`
}

// Validate requires the toggle field.
func (d *GuardrailsSettingsRequest) Validate(v *validator.MapValidator) {
	v.Field("external_detectors").Required()
}

// EvaluateRequest is the Test Policy body: sample text plus the draft
// detector config to run it against.
type EvaluateRequest struct {
	Text   string          `json:"text"`
	Config json.RawMessage `json:"config"`
}

// Validate requires sample text.
func (d *EvaluateRequest) Validate(v *validator.MapValidator) {
	v.Field("text").Required().String()
}
