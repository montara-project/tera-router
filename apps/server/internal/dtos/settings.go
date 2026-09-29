package dtos

import (
	"encoding/json"

	"tera-router/server/internal/lib/validator"
)

// AppSettings is the typed settings document the dashboard reads and edits,
// matching the web UI AppSettings model.
//
// The dashboard PATCHes only the fields a user actually changed (a single
// toggle sends `{"rtk_enabled":false}`), so every field is a pointer: nil
// means "not supplied" and the stored value is kept. A non-pointer bool would
// bind an absent field to false and silently reset unrelated settings.
type AppSettings struct {
	RTKEnabled             *bool   `json:"rtk_enabled"`
	SourceCodeFilter       *string `json:"source_code_filter"`
	CavemanEnabled         *bool   `json:"caveman_enabled"`
	TerseEnabled           *bool   `json:"terse_enabled"`
	HeadroomEnabled        *bool   `json:"headroom_enabled"`
	PonytailEnabled        *bool   `json:"ponytail_enabled"`
	ProviderRoundRobin     *bool   `json:"provider_round_robin"`
	ProviderStickyLimit    *int    `json:"provider_sticky_limit"`
	ChainRoundRobin        *bool   `json:"chain_round_robin"`
	ConnectTimeout         *int    `json:"connect_timeout"`
	StreamStallTimeout     *int    `json:"stream_stall_timeout"`
	RequestTimeout         *int    `json:"request_timeout"`
	EnforceRateLimits      *bool   `json:"enforce_rate_limits"`
	OutboundProxyEnabled   *bool   `json:"outbound_proxy_enabled"`
	RequestDetailRecording *bool   `json:"request_detail_recording"`
	BrandingDisplayName    *string `json:"branding_display_name"`
	BrandingTagline        *string `json:"branding_tagline"`
	BrandingTheme          *string `json:"branding_theme"`
}

// Validate accepts any JSON object as a settings patch; field-level rules
// are enforced by the merge logic in the handler instead.
func (s *AppSettings) Validate(v *validator.MapValidator) {}

// DefaultSettings returns the settings document used when nothing is stored.
// The values match the document the handler previously constructed inline, so
// a database that has never been written reads back identically.
func DefaultSettings() AppSettings {
	return AppSettings{
		RTKEnabled:             new(true),
		SourceCodeFilter:       new("off"),
		CavemanEnabled:         new(false),
		TerseEnabled:           new(false),
		HeadroomEnabled:        new(false),
		PonytailEnabled:        new(false),
		ProviderRoundRobin:     new(true),
		ProviderStickyLimit:    new(3),
		ChainRoundRobin:        new(false),
		ConnectTimeout:         new(60),
		StreamStallTimeout:     new(300),
		RequestTimeout:         new(300),
		EnforceRateLimits:      new(true),
		OutboundProxyEnabled:   new(false),
		RequestDetailRecording: new(true),
		BrandingDisplayName:    new("Tera Router"),
		BrandingTagline:        new(""),
		BrandingTheme:          new("forest-amber"),
	}
}

// MergeSettings overlays the non-nil fields of patch onto current and returns
// the result. A nil field keeps the stored value, so a one-key PATCH cannot
// reset the rest of the document.
func MergeSettings(current, patch AppSettings) AppSettings {
	out := current

	mergeBool(&out.RTKEnabled, patch.RTKEnabled)
	mergeBool(&out.CavemanEnabled, patch.CavemanEnabled)
	mergeBool(&out.TerseEnabled, patch.TerseEnabled)
	mergeBool(&out.HeadroomEnabled, patch.HeadroomEnabled)
	mergeBool(&out.PonytailEnabled, patch.PonytailEnabled)
	mergeBool(&out.ProviderRoundRobin, patch.ProviderRoundRobin)
	mergeBool(&out.ChainRoundRobin, patch.ChainRoundRobin)
	mergeBool(&out.EnforceRateLimits, patch.EnforceRateLimits)
	mergeBool(&out.OutboundProxyEnabled, patch.OutboundProxyEnabled)
	mergeBool(&out.RequestDetailRecording, patch.RequestDetailRecording)

	mergeString(&out.SourceCodeFilter, patch.SourceCodeFilter)
	mergeString(&out.BrandingDisplayName, patch.BrandingDisplayName)
	mergeString(&out.BrandingTagline, patch.BrandingTagline)
	mergeString(&out.BrandingTheme, patch.BrandingTheme)

	mergeInt(&out.ProviderStickyLimit, patch.ProviderStickyLimit)
	mergeInt(&out.ConnectTimeout, patch.ConnectTimeout)
	mergeInt(&out.StreamStallTimeout, patch.StreamStallTimeout)
	mergeInt(&out.RequestTimeout, patch.RequestTimeout)

	return out
}

// UnmarshalSettings parses a stored settings document over the defaults, so a
// document written before a field existed still reads back with a value.
func UnmarshalSettings(raw []byte) (AppSettings, error) {
	out := DefaultSettings()
	if err := json.Unmarshal(raw, &out); err != nil {
		return DefaultSettings(), err
	}
	return out, nil
}

func mergeBool(dst **bool, src *bool) {
	if src != nil {
		*dst = src
	}
}

func mergeInt(dst **int, src *int) {
	if src != nil {
		*dst = src
	}
}

func mergeString(dst **string, src *string) {
	if src != nil {
		*dst = src
	}
}
