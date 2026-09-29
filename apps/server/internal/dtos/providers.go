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

// CatalogProvider is a built-in provider spec, ported (condensed) from
// IDRouter's connectors catalog: the subset of metadata the dashboard needs
// to render the providers page and validate credentials.
type CatalogProvider struct {
	// Slug is the stable identifier used by accounts and the web UI.
	Slug string `json:"slug"`
	// Name is the human-readable display name.
	Name string `json:"name"`
	// Capabilities lists the service kinds this provider serves
	// (chat, embeddings, image, tts, stt, search).
	Capabilities []string `json:"capabilities"`
	// BaseURL is the default upstream endpoint for API-key providers.
	BaseURL string `json:"base_url,omitempty"`
	// AuthKind is the default authentication mechanism
	// (api_key, oauth, none).
	AuthKind string `json:"auth_kind"`
	// AuthModes lists every supported mechanism.
	AuthModes []string `json:"auth_modes"`
	// Official marks first-party providers; subscription/OAuth-session
	// providers are false and carry usage risk.
	Official bool `json:"official"`
	// Pinned providers render at the top of the listing.
	Pinned bool `json:"pinned"`
	// Notice is an optional human-readable usage note.
	Notice string `json:"notice,omitempty"`
}

// ProviderView matches the web UI Provider model: id, name, slug, connected,
// accounts, capabilities, official.
type ProviderView struct {
	ID           string   `json:"id"`
	Name         string   `json:"name"`
	Slug         string   `json:"slug"`
	Connected    bool     `json:"connected"`
	Accounts     int      `json:"accounts,omitempty"`
	Capabilities []string `json:"capabilities"`
	Official     bool     `json:"official,omitempty"`
	Notice       string   `json:"notice,omitempty"`
}

// ProviderOverview is the providers page payload: catalog providers split by
// whether an account is attached, plus custom providers outside the catalog.
type ProviderOverview struct {
	Connected []ProviderView `json:"connected"`
	Available []ProviderView `json:"available"`
}
