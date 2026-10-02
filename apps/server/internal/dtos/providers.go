package dtos

import "tera-router/server/internal/lib/validator"

// CustomProvider is the OpenAI-compatible upstream registration body
// (POST/PUT/PATCH /v1/custom-providers).
type CustomProvider struct {
	Name    string         `json:"name"`
	Slug    string         `json:"slug"`
	BaseURL string         `json:"base_url"`
	APIKind string         `json:"api_kind"`
	Pricing map[string]any `json:"pricing"`
	Enabled *bool          `json:"enabled"`
	// Pointer so PATCH can distinguish "not sent" from an explicit 0.
	Priority *int           `json:"priority"`
	Metadata map[string]any `json:"metadata"`
}

func (d *CustomProvider) Validate(v *validator.MapValidator) {
	v.Field("name").Required().String()
}

// ProviderModelState sets one catalog model's state
// (PATCH /v1/custom-providers/:id/models).
type ProviderModelState struct {
	ID    string `json:"id"`
	State string `json:"state"`
}

// ProviderModelStates is the per-model active/disabled update body.
type ProviderModelStates struct {
	Models []ProviderModelState `json:"models"`
}

func (d *ProviderModelStates) Validate(v *validator.MapValidator) {
	v.Field("models").Required()
}

// ModelTestMessage is one turn of a model test conversation.
type ModelTestMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// ModelTestRequest is the body of the model test endpoints
// (POST /v1/providers/:id/models/test and its custom-provider counterpart):
// one small conversation addressed to a single model.
type ModelTestRequest struct {
	Model    string             `json:"model"`
	Messages []ModelTestMessage `json:"messages"`
}

func (d *ModelTestRequest) Validate(v *validator.MapValidator) {
	v.Field("model").Required().String()
	v.Field("messages").Required()
}

// ModelTestResult reports one test chat completion against the upstream. A
// transport-level success with a model-side failure (bad model id, rejected
// credential, empty answer) is OK=false with Detail set, so the dashboard can
// render the reason inline instead of as a request error.
type ModelTestResult struct {
	OK           bool   `json:"ok"`
	Status       int    `json:"status"`
	LatencyMS    int64  `json:"latency_ms"`
	Model        string `json:"model"`
	Content      string `json:"content"`
	Detail       string `json:"detail"`
	InputTokens  int64  `json:"input_tokens"`
	OutputTokens int64  `json:"output_tokens"`
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
	// Dialect is the upstream wire format the gateway speaks to this
	// provider (openai, anthropic, openai_responses). Empty means the
	// provider is not routable yet.
	Dialect string `json:"dialect,omitempty"`
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
	// Hidden keeps a spec routable (Lookup) but out of the dashboard's
	// provider listing — used by OAuth-only upstreams that the UI reaches
	// through another provider's connect flow (codex behind OpenAI).
	Hidden bool `json:"-"`
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
	// APIKind is the upstream wire format (openai, anthropic, openai_responses)
	// — the catalog dialect for built-ins, the operator-set kind for custom
	// providers. Empty when the provider is not routable.
	APIKind string `json:"api_kind,omitempty"`
}

// ProviderOverview is the providers page payload: catalog providers split by
// whether an account is attached, plus custom providers outside the catalog.
type ProviderOverview struct {
	Connected []ProviderView `json:"connected"`
	Available []ProviderView `json:"available"`
}
