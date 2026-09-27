package services

import (
	"context"
	"encoding/json"
	"errors"

	"tera-router/server/internal/lib/apperr"
	"tera-router/server/internal/lib/validator"
	"tera-router/server/internal/repositories"
)

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

// DefaultSettings seeds the settings document on first read.
func DefaultSettings() AppSettings {
	return AppSettings{
		RTKEnabled:             true,
		SourceCodeFilter:       "off",
		ProviderRoundRobin:     true,
		ProviderStickyLimit:    3,
		ConnectTimeout:         60,
		StreamStallTimeout:     300,
		RequestTimeout:         300,
		EnforceRateLimits:      true,
		RequestDetailRecording: true,
		BrandingDisplayName:    "Tera Router",
		BrandingTheme:          "forest-amber",
	}
}

const settingsKey = "app"

// Validate accepts any JSON object as a settings patch; field-level rules
// are enforced by mergeSettings instead.
func (s *AppSettings) Validate(v *validator.MapValidator) {}

type SettingsService struct {
	repos *repositories.Repositories
	audit *AuditService
}

// Get loads the settings document, falling back to defaults when absent.
func (s *SettingsService) Get(ctx context.Context) (AppSettings, error) {
	raw, err := s.repos.Settings.Get(ctx, settingsKey)
	if err != nil {
		if errors.Is(err, apperr.ErrNotFound) {
			return DefaultSettings(), nil
		}
		return AppSettings{}, err
	}

	settings := DefaultSettings()
	if err := json.Unmarshal([]byte(raw), &settings); err != nil {
		return DefaultSettings(), nil
	}
	return settings, nil
}

// Update merges a partial settings patch over the stored document.
func (s *SettingsService) Update(ctx context.Context, actor string, patch AppSettings) (AppSettings, error) {
	current, err := s.Get(ctx)
	if err != nil {
		return AppSettings{}, err
	}

	merged := mergeSettings(current, patch)
	raw, err := json.Marshal(merged)
	if err != nil {
		return AppSettings{}, err
	}
	if err := s.repos.Settings.Put(ctx, settingsKey, string(raw)); err != nil {
		return AppSettings{}, err
	}
	s.audit.Record(ctx, actor, "settings.update", settingsKey, patch)
	return merged, nil
}

// mergeSettings applies only the fields the client explicitly set. The DTO
// binding gives us zero values for absent fields, so fields are merged by
// "patch is non-zero" semantics — matching the dashboard's PATCH-style use.
func mergeSettings(current, patch AppSettings) AppSettings {
	out := current

	// Booleans: patch fields are always sent by the settings editor, so take
	// them wholesale from the patch document.
	out.RTKEnabled = patch.RTKEnabled
	out.CavemanEnabled = patch.CavemanEnabled
	out.TerseEnabled = patch.TerseEnabled
	out.HeadroomEnabled = patch.HeadroomEnabled
	out.PonytailEnabled = patch.PonytailEnabled
	out.ProviderRoundRobin = patch.ProviderRoundRobin
	out.ChainRoundRobin = patch.ChainRoundRobin
	out.EnforceRateLimits = patch.EnforceRateLimits
	out.OutboundProxyEnabled = patch.OutboundProxyEnabled
	out.RequestDetailRecording = patch.RequestDetailRecording

	if patch.SourceCodeFilter != "" {
		out.SourceCodeFilter = patch.SourceCodeFilter
	}
	if patch.ProviderStickyLimit != 0 {
		out.ProviderStickyLimit = patch.ProviderStickyLimit
	}
	if patch.ConnectTimeout != 0 {
		out.ConnectTimeout = patch.ConnectTimeout
	}
	if patch.StreamStallTimeout != 0 {
		out.StreamStallTimeout = patch.StreamStallTimeout
	}
	if patch.RequestTimeout != 0 {
		out.RequestTimeout = patch.RequestTimeout
	}
	if patch.BrandingDisplayName != "" {
		out.BrandingDisplayName = patch.BrandingDisplayName
	}
	out.BrandingTagline = patch.BrandingTagline
	if patch.BrandingTheme != "" {
		out.BrandingTheme = patch.BrandingTheme
	}
	return out
}
