package dtos

import "tera-router/server/internal/lib/validator"

// CreateSkill is the skill creation body (POST /v1/skills).
type CreateSkill struct {
	Name        string  `json:"name"`
	Description *string `json:"description"`
	Prompt      string  `json:"prompt"`
}

func (d *CreateSkill) Validate(v *validator.MapValidator) {
	v.Field("name").Required().String()
	v.Field("prompt").Required().String()
}

// UpdateSkill is the skill patch body (PATCH /v1/skills/:id). Enabled switches
// gateway injection of the skill's prompt on or off.
type UpdateSkill struct {
	Enabled *bool `json:"enabled"`
}

func (d *UpdateSkill) Validate(v *validator.MapValidator) {}

// Pricing is the per-model pricing override upsert body
// (POST /v1/model-pricing-overrides). Rates are micros of a dollar per
// million tokens. TokenConsumptionRate is optional: omitted leaves the
// budget drain at 1:1, an explicit 0 marks the model free for token budgets.
type Pricing struct {
	Provider         string   `json:"provider"`
	Model            string   `json:"model"`
	InputMicros      int64    `json:"input_micros"`
	OutputMicros     int64    `json:"output_micros"`
	CacheReadMicros  int64    `json:"cache_read_micros"`
	CacheWriteMicros int64    `json:"cache_write_micros"`
	ReasoningMicros  int64    `json:"reasoning_micros"`
	TokenRate        *float64 `json:"token_consumption_rate"`
}

func (d *Pricing) Validate(v *validator.MapValidator) {
	v.Field("provider").Required().String()
}

// PricingListQuery pages the pricing overrides list
// (GET /v1/model-pricing-overrides). Search matches "<provider> <model>"
// case-insensitively; scope narrows to per-model rows ("model") or
// provider-wide rows ("provider", empty model).
type PricingListQuery struct {
	ListQuery
	Provider string `query:"provider"`
	Search   string `query:"search"`
	Scope    string `query:"scope"`
}

func (dto PricingListQuery) Validate(v *validator.MapValidator) {
	dto.ListQuery.Validate(v)
	v.Field("scope").WithinS("all", "model", "provider")
}

// Capability is the capability override upsert body
// (PUT /v1/capability-overrides).
type Capability struct {
	Provider     string   `json:"provider"`
	Model        string   `json:"model"`
	Capabilities []string `json:"capabilities"`
}

func (d *Capability) Validate(v *validator.MapValidator) {
	v.Field("provider").Required().String()
}
