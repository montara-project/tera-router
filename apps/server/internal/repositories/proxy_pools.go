package repositories

import (
	"context"
	"database/sql"
	"time"

	"tera-router/server/internal/models"
)

type ProxyPoolRepository struct {
	db *sql.DB
}

const proxyPoolColumns = `
	id, name, url, mode, label, status, last_tested_at, created_at, updated_at`

func scanProxyPool(row interface{ Scan(...any) error }) (models.ProxyPool, error) {
	var p models.ProxyPool
	err := row.Scan(
		&p.ID, &p.Name, &p.URL, &p.Mode, &p.Label, &p.Status, &p.LastTestedAt,
		&p.CreatedAt, &p.UpdatedAt,
	)
	return p, translateNotFound(err)
}

func (r *ProxyPoolRepository) Create(ctx context.Context, p models.ProxyPool) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO proxy_pools (id, name, url, mode, label, status, last_tested_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		p.ID, p.Name, p.URL, p.Mode, p.Label, p.Status, p.LastTestedAt,
	)
	return err
}

func (r *ProxyPoolRepository) List(ctx context.Context) ([]models.ProxyPool, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT`+proxyPoolColumns+` FROM proxy_pools ORDER BY created_at DESC`)
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
	return pools, rows.Err()
}

func (r *ProxyPoolRepository) FindByID(ctx context.Context, id string) (models.ProxyPool, error) {
	row := r.db.QueryRowContext(ctx, `SELECT`+proxyPoolColumns+` FROM proxy_pools WHERE id = $1`, id)
	return scanProxyPool(row)
}

func (r *ProxyPoolRepository) Update(ctx context.Context, p models.ProxyPool) error {
	res, err := r.db.ExecContext(ctx, `
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

func (r *ProxyPoolRepository) UpdateTestedAt(ctx context.Context, id string, at time.Time, status string) error {
	res, err := r.db.ExecContext(ctx,
		`UPDATE proxy_pools SET last_tested_at = $2, status = $3, updated_at = strftime('%Y-%m-%d %H:%M:%f+00:00', 'now') WHERE id = $1`, id, at, status)
	if err != nil {
		return err
	}
	return requireAffected(res, "proxy pool")
}

func (r *ProxyPoolRepository) Delete(ctx context.Context, id string) error {
	res, err := r.db.ExecContext(ctx, `DELETE FROM proxy_pools WHERE id = $1`, id)
	if err != nil {
		return err
	}
	return requireAffected(res, "proxy pool")
}
