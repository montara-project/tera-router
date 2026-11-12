package repositories

import (
	"context"
	"time"

	"tera-router/server/internal/models"

	"braces.dev/errtrace"
)

// ProxyPoolRepository manages outbound proxy pools and their health status.
type ProxyPoolRepository struct {
	BaseRepository
}

const proxyPoolColumns = `
	id, name, url, mode, label, status, last_tested_at, created_at, updated_at,
	bypass, disabled, strict`

func scanProxyPool(row rowScanner) (models.ProxyPool, error) {
	var p models.ProxyPool
	err := row.Scan(
		&p.ID, &p.Name, &p.URL, &p.Mode, &p.Label, &p.Status, &p.LastTestedAt,
		&p.CreatedAt, &p.UpdatedAt, &p.Bypass, &p.Disabled, &p.Strict,
	)
	return p, translateNotFound(err)
}

// Insert persists a new proxy pool.
func (r *ProxyPoolRepository) Insert(ctx context.Context, p models.ProxyPool) error {
	_, err := r.execContext(ctx, r.DB, `
		INSERT INTO proxy_pools (id, name, url, mode, label, status, last_tested_at, bypass, disabled, strict)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
		p.ID, p.Name, p.URL, p.Mode, p.Label, p.Status, p.LastTestedAt, p.Bypass, p.Disabled, p.Strict,
	)
	return err
}

// List returns every proxy pool, newest first.
func (r *ProxyPoolRepository) List(ctx context.Context) ([]models.ProxyPool, error) {
	rows, err := r.queryContext(ctx, r.DB, `SELECT`+proxyPoolColumns+` FROM proxy_pools ORDER BY created_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	pools := []models.ProxyPool{}
	for rows.Next() {
		p, err := scanProxyPool(rows)
		if err != nil {
			return nil, err
		}
		pools = append(pools, p)
	}
	return pools, errtrace.Wrap(rows.Err())
}

// Get returns one proxy pool by id.
func (r *ProxyPoolRepository) Get(ctx context.Context, id string) (models.ProxyPool, error) {
	row := r.queryRowContext(ctx, r.DB, `SELECT`+proxyPoolColumns+` FROM proxy_pools WHERE id = $1`, id)
	return scanProxyPool(row)
}

// UpdateTestedAt records the outcome of a health probe.
func (r *ProxyPoolRepository) UpdateTestedAt(ctx context.Context, id string, at time.Time, status string) error {
	res, err := r.execContext(ctx, r.DB,
		`UPDATE proxy_pools SET last_tested_at = $2, status = $3, updated_at = strftime('%Y-%m-%d %H:%M:%f+00:00', 'now') WHERE id = $1`, id, at, status)
	if err != nil {
		return err
	}
	return requireAffected(res, "proxy pool")
}

// Delete removes one proxy pool and detaches the accounts that referenced
// it: accounts.proxy_pool_id carries no foreign key, so a bare delete would
// leave a dangling pool id the gateway can no longer resolve.
func (r *ProxyPoolRepository) Delete(ctx context.Context, id string) error {
	return r.withTx(ctx, func(tx Executor) error {
		if _, err := r.execContext(ctx, tx, `UPDATE accounts SET proxy_pool_id = NULL, updated_at = strftime('%Y-%m-%d %H:%M:%f+00:00', 'now') WHERE proxy_pool_id = $1`, id); err != nil {
			return err
		}
		res, err := r.execContext(ctx, tx, `DELETE FROM proxy_pools WHERE id = $1`, id)
		if err != nil {
			return err
		}
		return requireAffected(res, "proxy pool")
	})
}

// InsertMany persists several pools atomically: a batch import lands whole or
// not at all.
func (r *ProxyPoolRepository) InsertMany(ctx context.Context, pools []models.ProxyPool) error {
	return r.withTx(ctx, func(tx Executor) error {
		for _, p := range pools {
			if _, err := r.execContext(ctx, tx, `
				INSERT INTO proxy_pools (id, name, url, mode, label, status, last_tested_at, bypass, disabled, strict)
				VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
				p.ID, p.Name, p.URL, p.Mode, p.Label, p.Status, p.LastTestedAt, p.Bypass, p.Disabled, p.Strict,
			); err != nil {
				return err
			}
		}
		return nil
	})
}

// Update rewrites a pool's editable fields.
func (r *ProxyPoolRepository) Update(ctx context.Context, p models.ProxyPool) error {
	res, err := r.execContext(ctx, r.DB, `
		UPDATE proxy_pools SET name = $2, url = $3, mode = $4, label = $5,
			bypass = $6, disabled = $7, strict = $8,
			updated_at = strftime('%Y-%m-%d %H:%M:%f+00:00', 'now')
		WHERE id = $1`,
		p.ID, p.Name, p.URL, p.Mode, p.Label, p.Bypass, p.Disabled, p.Strict,
	)
	if err != nil {
		return err
	}
	return requireAffected(res, "proxy pool")
}
