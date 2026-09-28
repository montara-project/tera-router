package repositories

import (
	"context"
	"database/sql"

	"tera-router/server/internal/models"
)

type ProviderRepository struct {
	db *sql.DB
}

const providerColumns = `
	id, name, slug, base_url, api_kind, pricing, enabled, priority, metadata, created_at, updated_at`

func scanProvider(row interface{ Scan(...any) error }) (models.CustomProvider, error) {
	var p models.CustomProvider
	err := row.Scan(
		&p.ID, &p.Name, &p.Slug, &p.BaseURL, &p.APIKind, &p.Pricing, &p.Enabled, &p.Priority,
		&p.Metadata, &p.CreatedAt, &p.UpdatedAt,
	)
	return p, translateNotFound(err)
}

func (r *ProviderRepository) Create(ctx context.Context, p models.CustomProvider) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO custom_providers (id, name, slug, base_url, api_kind, pricing, enabled, priority, metadata)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
		p.ID, p.Name, p.Slug, p.BaseURL, p.APIKind, p.Pricing, p.Enabled, p.Priority, p.Metadata,
	)
	return err
}

func (r *ProviderRepository) List(ctx context.Context) ([]models.CustomProvider, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT`+providerColumns+` FROM custom_providers ORDER BY created_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	providers := []models.CustomProvider{}
	for rows.Next() {
		p, err := scanProvider(rows)
		if err != nil {
			return nil, err
		}
		providers = append(providers, p)
	}
	return providers, rows.Err()
}

func (r *ProviderRepository) FindByID(ctx context.Context, id string) (models.CustomProvider, error) {
	row := r.db.QueryRowContext(ctx, `SELECT`+providerColumns+` FROM custom_providers WHERE id = $1`, id)
	return scanProvider(row)
}

func (r *ProviderRepository) Update(ctx context.Context, p models.CustomProvider) error {
	res, err := r.db.ExecContext(ctx, `
		UPDATE custom_providers
		SET name = $2, base_url = $3, api_kind = $4, pricing = $5, enabled = $6,
		    priority = $7, metadata = $8, updated_at = strftime('%Y-%m-%d %H:%M:%f+00:00', 'now')
		WHERE id = $1`,
		p.ID, p.Name, p.BaseURL, p.APIKind, p.Pricing, p.Enabled, p.Priority, p.Metadata,
	)
	if err != nil {
		return err
	}
	return requireAffected(res, "provider")
}

func (r *ProviderRepository) Delete(ctx context.Context, id string) error {
	res, err := r.db.ExecContext(ctx, `DELETE FROM custom_providers WHERE id = $1`, id)
	if err != nil {
		return err
	}
	return requireAffected(res, "provider")
}
