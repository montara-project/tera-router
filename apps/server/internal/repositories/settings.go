package repositories

import (
	"context"
)

// SettingRepository stores the dashboard settings document as raw JSON values
// keyed by name.
type SettingRepository struct {
	BaseRepository
}

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
