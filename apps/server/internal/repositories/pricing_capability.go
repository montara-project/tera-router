package repositories

import (
	"context"

	"tera-router/server/internal/lib/apperr"
	"tera-router/server/internal/models"

	"braces.dev/errtrace"
)

// PricingRepository manages per-(provider, model) pricing overrides.
type PricingRepository struct {
	BaseRepository
}

const pricingColumns = `
	id, provider, model, input_micros, output_micros, cache_read_micros, cache_write_micros,
	created_at, updated_at`

func scanPricing(row rowScanner) (models.PricingOverride, error) {
	var p models.PricingOverride
	err := row.Scan(
		&p.ID, &p.Provider, &p.Model, &p.InputMicros, &p.OutputMicros,
		&p.CacheReadMicros, &p.CacheWriteMicros, &p.CreatedAt, &p.UpdatedAt,
	)
	return p, translateNotFound(err)
}

// Upsert inserts or updates the override for one (provider, model) pair.
func (r *PricingRepository) Upsert(ctx context.Context, p models.PricingOverride) error {
	return r.upsertExec(ctx, p)
}

func (r *PricingRepository) upsertExec(ctx context.Context, p models.PricingOverride) error {
	_, err := r.execContext(ctx, r.DB, `
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

// Get returns the pricing override for one (provider, model) pair. A miss
// surfaces as apperr.ErrNotFound; the gateway treats that as "no override"
// and charges zero.
func (r *PricingRepository) Get(ctx context.Context, provider, model string) (models.PricingOverride, error) {
	return r.getExec(ctx, provider, model)
}

func (r *PricingRepository) getExec(ctx context.Context, provider, model string) (models.PricingOverride, error) {
	row := r.queryRowContext(ctx, r.DB,
		`SELECT`+pricingColumns+` FROM model_pricing_overrides WHERE provider = $1 AND model = $2`,
		provider, model)
	return scanPricing(row)
}

// List returns overrides ordered by provider/model, optionally narrowed to one
// provider.
func (r *PricingRepository) List(ctx context.Context, provider string) ([]models.PricingOverride, error) {
	return r.listExec(ctx, provider)
}

func (r *PricingRepository) listExec(ctx context.Context, provider string) ([]models.PricingOverride, error) {
	query := `SELECT` + pricingColumns + ` FROM model_pricing_overrides`
	args := []any{}
	if provider != "" {
		query += ` WHERE provider = $1`
		args = append(args, provider)
	}
	query += ` ORDER BY provider, model`

	rows, err := r.queryContext(ctx, r.DB, query, args...)
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
	return out, errtrace.Wrap(rows.Err())
}

// Delete removes the override for one (provider, model) pair.
func (r *PricingRepository) Delete(ctx context.Context, provider, model string) error {
	return r.deleteExec(ctx, provider, model)
}

func (r *PricingRepository) deleteExec(ctx context.Context, provider, model string) error {
	res, err := r.execContext(ctx, r.DB,
		`DELETE FROM model_pricing_overrides WHERE provider = $1 AND model = $2`, provider, model)
	if err != nil {
		return err
	}
	return requireAffected(res, "pricing override")
}

// CapabilityRepository manages per-(provider, model) capability overrides.
type CapabilityRepository struct {
	BaseRepository
}

const capabilityColumns = `
	id, provider, model, capabilities, created_at, updated_at`

func scanCapability(row rowScanner) (models.CapabilityOverride, error) {
	var c models.CapabilityOverride
	err := row.Scan(&c.ID, &c.Provider, &c.Model, (*jsonStrings)(&c.Capabilities), &c.CreatedAt, &c.UpdatedAt)
	return c, translateNotFound(err)
}

// Upsert inserts or updates the capability set of one (provider, model) pair.
func (r *CapabilityRepository) Upsert(ctx context.Context, c models.CapabilityOverride) error {
	return r.upsertExec(ctx, c)
}

func (r *CapabilityRepository) upsertExec(ctx context.Context, c models.CapabilityOverride) error {
	_, err := r.execContext(ctx, r.DB, `
		INSERT INTO model_capability_overrides (id, provider, model, capabilities)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (provider, model) DO UPDATE SET
			capabilities = EXCLUDED.capabilities, updated_at = strftime('%Y-%m-%d %H:%M:%f+00:00', 'now')`,
		c.ID, c.Provider, c.Model, jsonStrings(c.Capabilities),
	)
	return err
}

// List returns every capability override ordered by provider/model.
func (r *CapabilityRepository) List(ctx context.Context) ([]models.CapabilityOverride, error) {
	return r.listExec(ctx)
}

func (r *CapabilityRepository) listExec(ctx context.Context) ([]models.CapabilityOverride, error) {
	rows, err := r.queryContext(ctx, r.DB, `SELECT`+capabilityColumns+` FROM model_capability_overrides ORDER BY provider, model`)
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
	return out, errtrace.Wrap(rows.Err())
}

// Delete removes the capability override for one (provider, model) pair.
func (r *CapabilityRepository) Delete(ctx context.Context, provider, model string) error {
	return r.deleteExec(ctx, provider, model)
}

func (r *CapabilityRepository) deleteExec(ctx context.Context, provider, model string) error {
	res, err := r.execContext(ctx, r.DB,
		`DELETE FROM model_capability_overrides WHERE provider = $1 AND model = $2`, provider, model)
	if err != nil {
		return err
	}
	return requireAffected(res, "capability override")
}

// Reset clears every capability override.
func (r *CapabilityRepository) Reset(ctx context.Context) error {
	return r.resetExec(ctx)
}

func (r *CapabilityRepository) resetExec(ctx context.Context) error {
	if _, err := r.execContext(ctx, r.DB, `DELETE FROM model_capability_overrides`); err != nil {
		return apperr.New(apperr.KindInternal, "reset capability overrides: %v", err)
	}
	return nil
}
