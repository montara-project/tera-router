package repositories

import (
	"context"

	"tera-router/server/internal/models"

	"braces.dev/errtrace"
)

// ProviderRepository manages operator-defined custom providers.
type ProviderRepository struct {
	BaseRepository
}

const providerColumns = `
	id, name, slug, base_url, api_kind, pricing, enabled, priority, metadata, created_at, updated_at`

func scanProvider(row rowScanner) (models.CustomProvider, error) {
	var p models.CustomProvider
	err := row.Scan(
		&p.ID, &p.Name, &p.Slug, &p.BaseURL, &p.APIKind, &p.Pricing, &p.Enabled, &p.Priority,
		&p.Metadata, &p.CreatedAt, &p.UpdatedAt,
	)
	return p, translateNotFound(err)
}

// Insert persists a new custom provider.
func (r *ProviderRepository) Insert(ctx context.Context, p models.CustomProvider) error {
	return r.insertExec(ctx, p)
}

func (r *ProviderRepository) insertExec(ctx context.Context, p models.CustomProvider) error {
	_, err := r.execContext(ctx, r.DB, `
		INSERT INTO custom_providers (id, name, slug, base_url, api_kind, pricing, enabled, priority, metadata)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
		p.ID, p.Name, p.Slug, p.BaseURL, p.APIKind, p.Pricing, p.Enabled, p.Priority, p.Metadata,
	)
	return err
}

// GetBySlug resolves one custom provider by its unique slug.
func (r *ProviderRepository) GetBySlug(ctx context.Context, slug string) (models.CustomProvider, error) {
	return r.getBySlugExec(ctx, slug)
}

func (r *ProviderRepository) getBySlugExec(ctx context.Context, slug string) (models.CustomProvider, error) {
	row := r.queryRowContext(ctx, r.DB, `SELECT`+providerColumns+` FROM custom_providers WHERE slug = $1`, slug)
	return scanProvider(row)
}

// List returns every custom provider, newest first.
func (r *ProviderRepository) List(ctx context.Context) ([]models.CustomProvider, error) {
	return r.listExec(ctx)
}

func (r *ProviderRepository) listExec(ctx context.Context) ([]models.CustomProvider, error) {
	rows, err := r.queryContext(ctx, r.DB, `SELECT`+providerColumns+` FROM custom_providers ORDER BY created_at DESC`)
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
	return providers, errtrace.Wrap(rows.Err())
}

// Get returns one custom provider by id.
func (r *ProviderRepository) Get(ctx context.Context, id string) (models.CustomProvider, error) {
	return r.getExec(ctx, id)
}

func (r *ProviderRepository) getExec(ctx context.Context, id string) (models.CustomProvider, error) {
	row := r.queryRowContext(ctx, r.DB, `SELECT`+providerColumns+` FROM custom_providers WHERE id = $1`, id)
	return scanProvider(row)
}

// Update rewrites a custom provider.
func (r *ProviderRepository) Update(ctx context.Context, p models.CustomProvider) error {
	return r.updateExec(ctx, p)
}

func (r *ProviderRepository) updateExec(ctx context.Context, p models.CustomProvider) error {
	res, err := r.execContext(ctx, r.DB, `
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

// ProviderDeleteResult reports what one provider deletion removed. Accounts
// carry credentials, so the count is worth surfacing to the operator.
type ProviderDeleteResult struct {
	Slug     string
	Accounts int64
}

// Delete removes one custom provider together with everything scoped to it:
// its accounts (credentials), its stored model catalog, and its per-model
// pricing and capability overrides. The rows share no foreign key — accounts
// reference the provider by slug — so the cascade is explicit and runs in one
// transaction: a failure part-way leaves the provider intact rather than
// half-deleted.
//
// Usage records are deliberately kept: they are the historical ledger, and
// deleting a provider must not rewrite past spend.
func (r *ProviderRepository) Delete(ctx context.Context, id string) (ProviderDeleteResult, error) {
	provider, err := r.Get(ctx, id)
	if err != nil {
		return ProviderDeleteResult{}, err
	}

	var result ProviderDeleteResult
	result.Slug = provider.Slug
	err = r.withTx(ctx, func(tx Executor) error {
		accounts, err := r.execAffected(ctx, tx, `DELETE FROM accounts WHERE provider = $1`, provider.Slug)
		if err != nil {
			return err
		}
		result.Accounts = accounts

		if _, err := r.execAffected(ctx, tx,
			`DELETE FROM model_pricing_overrides WHERE provider = $1`, provider.Slug); err != nil {
			return err
		}
		if _, err := r.execAffected(ctx, tx,
			`DELETE FROM model_capability_overrides WHERE provider = $1`, provider.Slug); err != nil {
			return err
		}
		// The stored catalog is a settings row, not a table of its own.
		if _, err := r.execAffected(ctx, tx,
			`DELETE FROM settings WHERE key = $1`, ProviderModelsSettingsKey(provider.Slug)); err != nil {
			return err
		}
		return r.deleteExec(ctx, tx, id)
	})
	if err != nil {
		return ProviderDeleteResult{}, err
	}
	return result, nil
}

func (r *ProviderRepository) deleteExec(ctx context.Context, ex Executor, id string) error {
	res, err := r.execContext(ctx, ex, `DELETE FROM custom_providers WHERE id = $1`, id)
	if err != nil {
		return err
	}
	return requireAffected(res, "provider")
}
