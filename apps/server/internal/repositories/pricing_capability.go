package repositories

import (
	"context"
	"database/sql"

	"tera-router/server/internal/lib/apperr"
	"tera-router/server/internal/models"
)

type PricingRepository struct {
	db *sql.DB
}

const pricingColumns = `
	id, provider, model, input_micros, output_micros, cache_read_micros, cache_write_micros,
	created_at, updated_at`

func scanPricing(row interface{ Scan(...any) error }) (models.PricingOverride, error) {
	var p models.PricingOverride
	err := row.Scan(
		&p.ID, &p.Provider, &p.Model, &p.InputMicros, &p.OutputMicros,
		&p.CacheReadMicros, &p.CacheWriteMicros, &p.CreatedAt, &p.UpdatedAt,
	)
	return p, translateNotFound(err)
}

// Upsert inserts or updates the override for one (provider, model) pair.
func (r *PricingRepository) Upsert(ctx context.Context, p models.PricingOverride) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO model_pricing_overrides (id, provider, model, input_micros, output_micros, cache_read_micros, cache_write_micros)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		ON CONFLICT (provider, model) DO UPDATE SET
			input_micros = EXCLUDED.input_micros,
			output_micros = EXCLUDED.output_micros,
			cache_read_micros = EXCLUDED.cache_read_micros,
			cache_write_micros = EXCLUDED.cache_write_micros,
			updated_at = strftime('%Y-%m-%d %H:%M:%f+00:00', 'now')`,
		p.ID, p.Provider, p.Model, p.InputMicros, p.OutputMicros, p.CacheReadMicros, p.CacheWriteMicros,
	)
	return err
}

func (r *PricingRepository) List(ctx context.Context, provider string) ([]models.PricingOverride, error) {
	query := `SELECT` + pricingColumns + ` FROM model_pricing_overrides`
	args := []any{}
	if provider != "" {
		query += ` WHERE provider = $1`
		args = append(args, provider)
	}
	query += ` ORDER BY provider, model`

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []models.PricingOverride{}
	for rows.Next() {
		p, err := scanPricing(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

// Delete removes the override for one (provider, model) pair.
func (r *PricingRepository) Delete(ctx context.Context, provider, model string) error {
	res, err := r.db.ExecContext(ctx,
		`DELETE FROM model_pricing_overrides WHERE provider = $1 AND model = $2`, provider, model)
	if err != nil {
		return err
	}
	return requireAffected(res, "pricing override")
}

type CapabilityRepository struct {
	db *sql.DB
}

const capabilityColumns = `
	id, provider, model, capabilities, created_at, updated_at`

func scanCapability(row interface{ Scan(...any) error }) (models.CapabilityOverride, error) {
	var c models.CapabilityOverride
	err := row.Scan(&c.ID, &c.Provider, &c.Model, (*jsonStrings)(&c.Capabilities), &c.CreatedAt, &c.UpdatedAt)
	if err != nil {
		return models.CapabilityOverride{}, translateNotFound(err)
	}
	return c, nil
}

func (r *CapabilityRepository) Upsert(ctx context.Context, c models.CapabilityOverride) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO model_capability_overrides (id, provider, model, capabilities)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (provider, model) DO UPDATE SET
			capabilities = EXCLUDED.capabilities, updated_at = strftime('%Y-%m-%d %H:%M:%f+00:00', 'now')`,
		c.ID, c.Provider, c.Model, jsonStrings(c.Capabilities),
	)
	return err
}

func (r *CapabilityRepository) List(ctx context.Context) ([]models.CapabilityOverride, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT`+capabilityColumns+` FROM model_capability_overrides ORDER BY provider, model`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []models.CapabilityOverride{}
	for rows.Next() {
		c, err := scanCapability(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

func (r *CapabilityRepository) Delete(ctx context.Context, provider, model string) error {
	res, err := r.db.ExecContext(ctx,
		`DELETE FROM model_capability_overrides WHERE provider = $1 AND model = $2`, provider, model)
	if err != nil {
		return err
	}
	return requireAffected(res, "capability override")
}

func (r *CapabilityRepository) Reset(ctx context.Context) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM model_capability_overrides`)
	if err != nil {
		return apperr.New(apperr.KindInternal, "reset capability overrides: %v", err)
	}
	return nil
}
