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

// GuardrailsSettings is the stored settings document for the tenant-wide
// toggle, persisted as JSON under the "guardrails" settings key.
type GuardrailsSettings struct {
	ExternalDetectors bool `json:"external_detectors"`
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

// GuardrailMetrics is the guardrails overview payload for one time range.
// Checked counts every request the gateway screened: the metered requests
// plus the ones the guardrails blocked before metering.
type GuardrailMetrics struct {
	Range     string                 `json:"range"`
	Hourly    bool                   `json:"hourly"`
	Checked   int64                  `json:"checked"`
	Blocked   int64                  `json:"blocked"`
	Masked    int64                  `json:"masked"`
	Warned    int64                  `json:"warned"`
	Logged    int64                  `json:"logged"`
	Overhead  GuardrailOverhead      `json:"overhead"`
	Series    []GuardrailMetricPoint `json:"series"`
	Detectors []GuardrailMetricGroup `json:"detectors"`
	Reasons   []GuardrailMetricCount `json:"reasons"`
	Keys      []GuardrailMetricGroup `json:"keys"`
	Models    []GuardrailMetricGroup `json:"models"`
	Entities  []GuardrailMetricCount `json:"entities"`
}

// GuardrailMetricPoint is one bucket of the actions series: a day, or an hour
// on the short ranges.
type GuardrailMetricPoint struct {
	Bucket  string `json:"bucket"`
	Blocked int64  `json:"blocked"`
	Masked  int64  `json:"masked"`
	Warned  int64  `json:"warned"`
	Logged  int64  `json:"logged"`
}

// GuardrailMetricGroup is one ranked breakdown row: Key is the stable id and
// Label the name to show. The counters split the decisions by kind.
type GuardrailMetricGroup struct {
	Key     string `json:"key"`
	Label   string `json:"label"`
	Blocked int64  `json:"blocked"`
	Masked  int64  `json:"masked"`
	Warned  int64  `json:"warned"`
	Logged  int64  `json:"logged"`
}

// GuardrailMetricCount is one ranked count with no decision split.
type GuardrailMetricCount struct {
	Key   string `json:"key"`
	Count int64  `json:"count"`
}

// GuardrailOverhead is how long screening took on the window's decisions, in
// milliseconds. Samples is 0 while no decision records a duration.
type GuardrailOverhead struct {
	Samples int64 `json:"samples"`
	P50     int64 `json:"p50"`
	P95     int64 `json:"p95"`
	Avg     int64 `json:"avg"`
}

// GuardrailDecision is one gateway decision as the audit tab lists it.
type GuardrailDecision struct {
	ID         string   `json:"id"`
	Time       string   `json:"time"`
	Actor      string   `json:"actor"`
	Decision   string   `json:"decision"`
	Detectors  []string `json:"detectors"`
	Entities   []string `json:"entities"`
	Reasons    []string `json:"reasons"`
	KeyID      string   `json:"key_id"`
	KeyName    string   `json:"key_name"`
	Model      string   `json:"model"`
	Chain      string   `json:"chain"`
	RequestID  string   `json:"request_id"`
	OverheadMS int64    `json:"overhead_ms"`
}
