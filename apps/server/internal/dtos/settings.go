package dtos

import "tera-router/server/internal/lib/validator"

// AppSettings is the typed settings document the dashboard edits, matching
// the web UI AppSettings model.
type AppSettings struct {
	RTKEnabled             bool   `json:"rtkEnabled"`
	SourceCodeFilter       string `json:"sourceCodeFilter"`
	CavemanEnabled         bool   `json:"cavemanEnabled"`
	TerseEnabled           bool   `json:"terseEnabled"`
	HeadroomEnabled        bool   `json:"headroomEnabled"`
	PonytailEnabled        bool   `json:"ponytailEnabled"`
	ProviderRoundRobin     bool   `json:"providerRoundRobin"`
	ProviderStickyLimit    int    `json:"providerStickyLimit"`
	ChainRoundRobin        bool   `json:"chainRoundRobin"`
	ConnectTimeout         int    `json:"connectTimeout"`
	StreamStallTimeout     int    `json:"streamStallTimeout"`
	RequestTimeout         int    `json:"requestTimeout"`
	EnforceRateLimits      bool   `json:"enforceRateLimits"`
	OutboundProxyEnabled   bool   `json:"outboundProxyEnabled"`
	RequestDetailRecording bool   `json:"requestDetailRecording"`
	BrandingDisplayName    string `json:"brandingDisplayName"`
	BrandingTagline        string `json:"brandingTagline"`
	BrandingTheme          string `json:"brandingTheme"`
}

// Validate accepts any JSON object as a settings patch; field-level rules
// are enforced by the merge logic in the handler instead.
func (s *AppSettings) Validate(v *validator.MapValidator) {}
