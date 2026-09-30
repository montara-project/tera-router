// Package modelcatalog persists the model list a custom provider's upstream
// advertises, as fetched by the dashboard's "Fetch models" action
// (GET /v1/custom-providers/:id/models). The stored catalog is what lets the
// gateway resolve a bare model id — "deepseek-v4.1-flash" instead of
// "custom-openai-zrouter/deepseek-v4.1-flash" — and lets /v1/models advertise
// it, without the operator creating an alias per model.
//
// The design mirrors IDrouter's user-models store: one JSON blob per provider
// in the settings kv table, written on refresh and read during resolution.
package modelcatalog

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"tera-router/server/internal/lib/apperr"
	"tera-router/server/internal/repositories"
)

// BlobVersion is the current wire format. An unknown version is treated as no
// catalog so the next fetch rewrites the blob instead of failing.
const BlobVersion = 1

// SettingsKeyPrefix is prepended to the provider slug for the settings key.
const SettingsKeyPrefix = "provider_models_"

// ErrNoCatalog reports that a provider has no usable stored catalog: never
// fetched, corrupt, or written by an incompatible version.
var ErrNoCatalog = errors.New("modelcatalog: no stored catalog for provider")

// Catalog is the stored model list of one custom provider.
type Catalog struct {
	Version   int       `json:"version"`
	FetchedAt time.Time `json:"fetched_at"`
	Models    []string  `json:"models"`
}

// SettingsKey returns the settings kv key for a provider slug.
func SettingsKey(providerSlug string) string {
	return SettingsKeyPrefix + providerSlug
}

// Store persists the model list as the provider's catalog, replacing any
// previous one.
func Store(ctx context.Context, r *repositories.SettingRepository, providerSlug string, models []string) error {
	if models == nil {
		models = []string{}
	}
	raw, err := json.Marshal(Catalog{Version: BlobVersion, FetchedAt: time.Now(), Models: models})
	if err != nil {
		return err
	}
	return r.Upsert(ctx, SettingsKey(providerSlug), string(raw))
}

// Load returns the stored catalog for a provider, or ErrNoCatalog when the
// provider has none.
func Load(ctx context.Context, r *repositories.SettingRepository, providerSlug string) (Catalog, error) {
	raw, err := r.Get(ctx, SettingsKey(providerSlug))
	if err != nil {
		if errors.Is(err, apperr.ErrNotFound) {
			return Catalog{}, ErrNoCatalog
		}
		return Catalog{}, err
	}
	var blob Catalog
	if jsonErr := json.Unmarshal([]byte(raw), &blob); jsonErr != nil || blob.Version != BlobVersion {
		return Catalog{}, ErrNoCatalog
	}
	return blob, nil
}
