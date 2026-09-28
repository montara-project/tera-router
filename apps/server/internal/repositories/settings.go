package repositories

import (
	"context"
	"database/sql"
)

type SettingRepository struct {
	db *sql.DB
}

// Get returns the raw JSON value for a settings key.
func (r *SettingRepository) Get(ctx context.Context, key string) (string, error) {
	row := r.db.QueryRowContext(ctx, `SELECT value FROM settings WHERE key = $1`, key)
	var value string
	err := row.Scan(&value)
	return value, translateNotFound(err)
}

// Put upserts a settings key with its raw JSON value.
func (r *SettingRepository) Put(ctx context.Context, key, value string) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO settings (key, value) VALUES ($1, $2)
		ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = strftime('%Y-%m-%d %H:%M:%f+00:00', 'now')`,
		key, value,
	)
	return err
}
