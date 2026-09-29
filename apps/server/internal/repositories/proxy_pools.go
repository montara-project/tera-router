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
	id, name, url, mode, label, status, last_tested_at, created_at, updated_at`

func scanProxyPool(row rowScanner) (models.ProxyPool, error) {
	var p models.ProxyPool
	err := row.Scan(
		&p.ID, &p.Name, &p.URL, &p.Mode, &p.Label, &p.Status, &p.LastTestedAt,
		&p.CreatedAt, &p.UpdatedAt,
	)
	return p, translateNotFound(err)
}

// Insert persists a new proxy pool.
func (r *ProxyPoolRepository) Insert(ctx context.Context, p models.ProxyPool) error {
	return r.insertExec(ctx, p)
}

func (r *ProxyPoolRepository) insertExec(ctx context.Context, p models.ProxyPool) error {
	_, err := r.execContext(ctx, r.DB, `
		INSERT INTO proxy_pools (id, name, url, mode, label, status, last_tested_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		p.ID, p.Name, p.URL, p.Mode, p.Label, p.Status, p.LastTestedAt,
	)
	return err
}

// List returns every proxy pool, newest first.
func (r *ProxyPoolRepository) List(ctx context.Context) ([]models.ProxyPool, error) {
	return r.listExec(ctx)
}

func (r *ProxyPoolRepository) listExec(ctx context.Context) ([]models.ProxyPool, error) {
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
	return r.getExec(ctx, id)
}

func (r *ProxyPoolRepository) getExec(ctx context.Context, id string) (models.ProxyPool, error) {
	row := r.queryRowContext(ctx, r.DB, `SELECT`+proxyPoolColumns+` FROM proxy_pools WHERE id = $1`, id)
	return scanProxyPool(row)
}

// Update rewrites a proxy pool.
func (r *ProxyPoolRepository) Update(ctx context.Context, p models.ProxyPool) error {
	return r.updateExec(ctx, p)
}

func (r *ProxyPoolRepository) updateExec(ctx context.Context, p models.ProxyPool) error {
	res, err := r.execContext(ctx, r.DB, `
		UPDATE proxy_pools
		SET name = $2, url = $3, mode = $4, label = $5, status = $6, updated_at = strftime('%Y-%m-%d %H:%M:%f+00:00', 'now')
		WHERE id = $1`,
		p.ID, p.Name, p.URL, p.Mode, p.Label, p.Status,
	)
	if err != nil {
		return err
	}
	return requireAffected(res, "proxy pool")
}

// UpdateTestedAt records the outcome of a health probe.
func (r *ProxyPoolRepository) UpdateTestedAt(ctx context.Context, id string, at time.Time, status string) error {
	return r.updateTestedAtExec(ctx, id, at, status)
}

func (r *ProxyPoolRepository) updateTestedAtExec(ctx context.Context, id string, at time.Time, status string) error {
	res, err := r.execContext(ctx, r.DB,
		`UPDATE proxy_pools SET last_tested_at = $2, status = $3, updated_at = strftime('%Y-%m-%d %H:%M:%f+00:00', 'now') WHERE id = $1`, id, at, status)
	if err != nil {
		return err
	}
	return requireAffected(res, "proxy pool")
}

// Delete removes one proxy pool.
func (r *ProxyPoolRepository) Delete(ctx context.Context, id string) error {
	return r.deleteExec(ctx, id)
}

func (r *ProxyPoolRepository) deleteExec(ctx context.Context, id string) error {
	res, err := r.execContext(ctx, r.DB, `DELETE FROM proxy_pools WHERE id = $1`, id)
	if err != nil {
		return err
	}
	return requireAffected(res, "proxy pool")
}
