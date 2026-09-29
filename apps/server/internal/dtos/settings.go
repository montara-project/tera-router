package dtos

import "tera-router/server/internal/lib/validator"

// AppSettings is the typed settings document the dashboard edits, matching
// the web UI AppSettings model.
type AppSettings struct {
	RTKEnabled             bool   `json:"rtk_enabled"`
	SourceCodeFilter       string `json:"source_code_filter"`
	CavemanEnabled         bool   `json:"caveman_enabled"`
	TerseEnabled           bool   `json:"terse_enabled"`
	HeadroomEnabled        bool   `json:"headroom_enabled"`
	PonytailEnabled        bool   `json:"ponytail_enabled"`
	ProviderRoundRobin     bool   `json:"provider_round_robin"`
	ProviderStickyLimit    int    `json:"provider_sticky_limit"`
	ChainRoundRobin        bool   `json:"chain_round_robin"`
	ConnectTimeout         int    `json:"connect_timeout"`
	StreamStallTimeout     int    `json:"stream_stall_timeout"`
	RequestTimeout         int    `json:"request_timeout"`
	EnforceRateLimits      bool   `json:"enforce_rate_limits"`
	OutboundProxyEnabled   bool   `json:"outbound_proxy_enabled"`
	RequestDetailRecording bool   `json:"request_detail_recording"`
	BrandingDisplayName    string `json:"branding_display_name"`
	BrandingTagline        string `json:"branding_tagline"`
	BrandingTheme          string `json:"branding_theme"`
}

// Validate accepts any JSON object as a settings patch; field-level rules
// are enforced by the merge logic in the handler instead.
func (s *AppSettings) Validate(v *validator.MapValidator) {}
