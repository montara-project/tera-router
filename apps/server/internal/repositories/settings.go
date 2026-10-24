package repositories

import (
	"context"
	"encoding/json"
	"errors"

	"tera-router/server/internal/lib/apperr"
	"tera-router/server/internal/models"
)

// SettingRepository stores the dashboard settings document as raw JSON values
// keyed by name.
type SettingRepository struct {
	BaseRepository
}

// ProviderModelsSettingsKey returns the settings key holding one provider's
// stored model catalog (the value's shape is owned by the modelcatalog
// package). The key format lives here so the provider cascade can remove it in
// the same transaction that deletes the provider, without this package
// importing modelcatalog — which imports this one.
func ProviderModelsSettingsKey(providerSlug string) string {
	return "provider_models_" + providerSlug
}

// ProviderRoutingSettingsKey returns the settings key holding one provider's
// account strategy (models.ProviderRouting).
func ProviderRoutingSettingsKey(providerSlug string) string {
	return "provider_routing_" + providerSlug
}

// ProviderRouting returns a provider's account strategy, or the default when
// the operator never set one.
func (r *SettingRepository) ProviderRouting(ctx context.Context, providerSlug string) (models.ProviderRouting, error) {
	raw, err := r.getExec(ctx, ProviderRoutingSettingsKey(providerSlug))
	if errors.Is(err, apperr.ErrNotFound) {
		return models.DefaultProviderRouting(), nil
	}
	if err != nil {
		return models.ProviderRouting{}, err
	}
	out := models.DefaultProviderRouting()
	if err := json.Unmarshal([]byte(raw), &out); err != nil {
		return models.ProviderRouting{}, err
	}
	return out, nil
}

// SetProviderRouting stores a provider's account strategy.
func (r *SettingRepository) SetProviderRouting(ctx context.Context, providerSlug string, routing models.ProviderRouting) error {
	raw, err := json.Marshal(routing)
	if err != nil {
		return err
	}
	return r.upsertExec(ctx, ProviderRoutingSettingsKey(providerSlug), string(raw))
}

// CloudflareTunnelSettingsKey holds a JSON boolean: whether the Cloudflare
// tunnel was left enabled, so the server brings it back on the next boot.
const CloudflareTunnelSettingsKey = "tunnel_cloudflare_enabled"

// Get returns the raw JSON value for a settings key.
func (r *SettingRepository) Get(ctx context.Context, key string) (string, error) {
	return r.getExec(ctx, key)
}

func (r *SettingRepository) getExec(ctx context.Context, key string) (string, error) {
	row := r.queryRowContext(ctx, r.DB, `SELECT value FROM settings WHERE key = $1`, key)
	var value string
	err := row.Scan(&value)
	return value, translateNotFound(err)
}

// Upsert stores a settings key with its raw JSON value.
func (r *SettingRepository) Upsert(ctx context.Context, key, value string) error {
	return r.upsertExec(ctx, key, value)
}

func (r *SettingRepository) upsertExec(ctx context.Context, key, value string) error {
	_, err := r.execContext(ctx, r.DB, `
		INSERT INTO settings (key, value) VALUES ($1, $2)
		ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = strftime('%Y-%m-%d %H:%M:%f+00:00', 'now')`,
		key, value,
	)
	return err
}
