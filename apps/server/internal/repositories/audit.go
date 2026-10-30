package repositories

import (
	"context"

	"tera-router/server/internal/models"
)

// AuditRepository appends and reads the audit trail.
type AuditRepository struct {
	BaseRepository
}

// Insert appends one audit entry.
func (r *AuditRepository) Insert(ctx context.Context, e models.AuditEntry) error {
	_, err := r.execContext(ctx, r.DB, `
		INSERT INTO audit_entries (id, actor, action, target, detail)
		VALUES ($1, $2, $3, $4, $5)`,
		e.ID, e.Actor, e.Action, e.Target, e.Detail,
	)
	return err
}
