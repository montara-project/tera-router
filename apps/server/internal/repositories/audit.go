package repositories

import (
	"context"

	"tera-router/server/internal/models"

	"braces.dev/errtrace"
)

// AuditRepository appends and reads the audit trail.
type AuditRepository struct {
	BaseRepository
}

// Insert appends one audit entry.
func (r *AuditRepository) Insert(ctx context.Context, e models.AuditEntry) error {
	return r.insertExec(ctx, e)
}

func (r *AuditRepository) insertExec(ctx context.Context, e models.AuditEntry) error {
	_, err := r.execContext(ctx, r.DB, `
		INSERT INTO audit_entries (id, actor, action, target, detail)
		VALUES ($1, $2, $3, $4, $5)`,
		e.ID, e.Actor, e.Action, e.Target, e.Detail,
	)
	return err
}

// List returns the newest audit entries, capped at limit.
func (r *AuditRepository) List(ctx context.Context, limit int) ([]models.AuditEntry, error) {
	return r.listExec(ctx, limit)
}

func (r *AuditRepository) listExec(ctx context.Context, limit int) ([]models.AuditEntry, error) {
	rows, err := r.queryContext(ctx, r.DB, `
		SELECT id, actor, action, target, detail, created_at
		FROM audit_entries ORDER BY created_at DESC LIMIT $1`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []models.AuditEntry{}
	for rows.Next() {
		var e models.AuditEntry
		if err := rows.Scan(&e.ID, &e.Actor, &e.Action, &e.Target, &e.Detail, &e.CreatedAt); err != nil {
			return nil, errtrace.Wrap(err)
		}
		out = append(out, e)
	}
	return out, errtrace.Wrap(rows.Err())
}
