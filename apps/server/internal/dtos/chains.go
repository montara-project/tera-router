package dtos

import "tera-router/server/internal/lib/validator"

// ChainStep is one ordered fallback target inside a Chain request.
type ChainStep struct {
	Provider string `json:"provider"`
	Model    string `json:"model"`
	// Active defaults to true when omitted.
	Active *bool `json:"active"`
}

// Chain is the chain create/update request body (POST/PUT /v1/chains).
type Chain struct {
	Name     string `json:"name"`
	Strategy string `json:"strategy"`
	// Pointers so an update can clear the final fallback or the context
	// window by sending "" or 0, while an omitted field keeps the stored value.
	FallbackProvider *string `json:"fallback_provider"`
	FallbackModel    *string `json:"fallback_model"`
	ContextWindow    *int    `json:"context_window"`
	Enabled          *bool   `json:"enabled"`
	// Pointer so an update can tell "field omitted" (keep the stored steps)
	// from "explicitly empty" (clear the chain).
	Steps *[]ChainStep `json:"steps"`
}

// ChainNamePattern is what a chain name may contain. Callers address a chain
// as "chain:<name>", so the name stays a plain token.
const ChainNamePattern = `^[A-Za-z0-9._-]+$`

func (d *Chain) Validate(v *validator.MapValidator) {
	v.Field("name").Required().String().Regex(ChainNamePattern)
}

// AliasTarget is one ordered candidate inside an Alias request.
type AliasTarget struct {
	Provider string `json:"provider"`
	Model    string `json:"model"`
	Active   *bool  `json:"active"`
}

// Alias is the model alias pool upsert body (PUT /v1/models/alias).
type Alias struct {
	Name string `json:"name"`
	// PreviousName, when set and different from Name, renames that pool.
	PreviousName  string        `json:"previous_name"`
	Group         string        `json:"group"`
	ContextWindow int           `json:"context_window"`
	Active        *bool         `json:"active"`
	Targets       []AliasTarget `json:"targets"`
}

func (d *Alias) Validate(v *validator.MapValidator) {
	v.Field("name").Required().String()
}
