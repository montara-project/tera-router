package repositories

import (
	"context"
	"database/sql"

	"tera-router/server/internal/models"
)

type AuditRepository struct {
	db *sql.DB
}

func (r *AuditRepository) Insert(ctx context.Context, e models.AuditEntry) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO audit_entries (id, actor, action, target, detail)
		VALUES ($1, $2, $3, $4, $5::jsonb)`,
		e.ID, e.Actor, e.Action, e.Target, e.Detail,
	)
	return err
}

func (r *AuditRepository) List(ctx context.Context, limit int) ([]models.AuditEntry, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, actor, action, target, detail::text, created_at
		FROM audit_entries ORDER BY created_at DESC LIMIT $1`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []models.AuditEntry{}
	for rows.Next() {
		var e models.AuditEntry
		if err := rows.Scan(&e.ID, &e.Actor, &e.Action, &e.Target, &e.Detail, &e.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, e)
	}
	return out, rows.Err()
}
