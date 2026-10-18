package repositories

import (
	"context"
	"database/sql"

	"tera-router/server/internal/models"

	"github.com/google/uuid"
)

// IPBlockRepository stores the client address blocklist.
type IPBlockRepository struct {
	BaseRepository
}

// ListActive prunes expired blocks and returns the rest, newest first.
func (r *IPBlockRepository) ListActive(ctx context.Context) ([]models.IPBlock, error) {
	if _, err := r.execContext(ctx, r.DB,
		`DELETE FROM ip_blocks WHERE expires_at IS NOT NULL AND expires_at <= strftime('%Y-%m-%d %H:%M:%f+00:00', 'now')`); err != nil {
		return nil, err
	}
	rows, err := r.queryContext(ctx, r.DB,
		`SELECT id, cidr, reason, expires_at, created_at FROM ip_blocks ORDER BY created_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []models.IPBlock{}
	for rows.Next() {
		var b models.IPBlock
		if err := rows.Scan(&b.ID, &b.CIDR, &b.Reason, &b.ExpiresAt, &b.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, b)
	}
	return out, rows.Err()
}

// Insert adds a permanent block.
func (r *IPBlockRepository) Insert(ctx context.Context, cidr, reason string) (string, error) {
	id := uuid.NewString()
	_, err := r.execContext(ctx, r.DB,
		`INSERT INTO ip_blocks (id, cidr, reason) VALUES ($1, $2, $3)`, id, cidr, reason)
	return id, translateUnique(err, "this address is already blocked")
}

// BlockFor adds or extends a temporary block lasting minutes. A permanent
// block on the same range is left as it is.
func (r *IPBlockRepository) BlockFor(ctx context.Context, cidr, reason string, minutes int) error {
	_, err := r.execContext(ctx, r.DB, `
		INSERT INTO ip_blocks (id, cidr, reason, expires_at)
		VALUES ($1, $2, $3, strftime('%Y-%m-%d %H:%M:%f+00:00', 'now', '+' || $4 || ' minutes'))
		ON CONFLICT (cidr) DO UPDATE SET reason = excluded.reason, expires_at = excluded.expires_at
		WHERE ip_blocks.expires_at IS NOT NULL`,
		uuid.NewString(), cidr, reason, minutes)
	return err
}

// Delete removes a block.
func (r *IPBlockRepository) Delete(ctx context.Context, id string) error {
	res, err := r.execContext(ctx, r.DB, `DELETE FROM ip_blocks WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return translateNotFound(sql.ErrNoRows)
	}
	return nil
}
