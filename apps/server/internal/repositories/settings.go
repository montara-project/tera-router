package repositories

import (
	"context"
	"database/sql"

	"tera-router/server/internal/models"
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
		INSERT INTO settings (key, value) VALUES ($1, $2::jsonb)
		ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
		key, value,
	)
	return err
}

func (r *SettingRepository) All(ctx context.Context) ([]models.Setting, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT key, value::text, updated_at FROM settings ORDER BY key`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []models.Setting{}
	for rows.Next() {
		var s models.Setting
		if err := rows.Scan(&s.Key, &s.Value, &s.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, s)
	}
	return out, rows.Err()
}
