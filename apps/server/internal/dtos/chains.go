package dtos

import "tera-router/server/internal/lib/validator"

// ChainStep is one ordered fallback target inside a Chain request.
type ChainStep struct {
	Provider string `json:"provider"`
	Model    string `json:"model"`
}

// Chain is the chain create/update request body (POST/PUT/PATCH /v1/chains).
type Chain struct {
	Name             string `json:"name"`
	Strategy         string `json:"strategy"`
	FallbackProvider string `json:"fallback_provider"`
	FallbackModel    string `json:"fallback_model"`
	ContextWindow    int    `json:"context_window"`
	Enabled          *bool  `json:"enabled"`
	// Pointer so an update can tell "field omitted" (keep the stored steps)
	// from "explicitly empty" (clear the chain).
	Steps *[]ChainStep `json:"steps"`
}

func (d *Chain) Validate(v *validator.MapValidator) {
	v.Field("name").Required().String()
}

// AliasTarget is one ordered candidate inside an Alias request.
type AliasTarget struct {
	Provider string `json:"provider"`
	Model    string `json:"model"`
	Active   *bool  `json:"active"`
}

// Alias is the model alias pool upsert body (PUT /v1/models/alias).
type Alias struct {
	Name          string        `json:"name"`
	ContextWindow int           `json:"context_window"`
	Active        *bool         `json:"active"`
	Targets       []AliasTarget `json:"targets"`
}

func (d *Alias) Validate(v *validator.MapValidator) {
	v.Field("name").Required().String()
}
