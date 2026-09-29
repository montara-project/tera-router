package repositories

import (
	"context"

	"tera-router/server/internal/models"

	"braces.dev/errtrace"
)

// GuardrailRepository manages content-safety policies and reads their audit
// trail.
type GuardrailRepository struct {
	BaseRepository
}

const guardrailColumns = `id, name, scope, target, protections, config, enabled, created_at, updated_at`

func scanGuardrailPolicy(row rowScanner) (models.GuardrailPolicy, error) {
	var p models.GuardrailPolicy
	var enabled int
	err := row.Scan(&p.ID, &p.Name, &p.Scope, &p.Target, &p.Protections, &p.Config, &enabled, &p.CreatedAt, &p.UpdatedAt)
	if err == nil {
		p.Enabled = enabled != 0
	}
	return p, translateNotFound(err)
}

// List returns every guardrail policy, global scope first then newest.
func (r *GuardrailRepository) List(ctx context.Context) ([]models.GuardrailPolicy, error) {
	return r.listExec(ctx, r.DB, `
		SELECT `+guardrailColumns+` FROM guardrail_policies
		ORDER BY (scope = 'global') DESC, created_at DESC`)
}

// ListEnabled returns the enabled policies used for evaluation, ordered by
// scope specificity: key first, then chain, model, provider, and global as
// the last-resort master policy.
func (r *GuardrailRepository) ListEnabled(ctx context.Context) ([]models.GuardrailPolicy, error) {
	return r.listExec(ctx, r.DB, `
		SELECT `+guardrailColumns+` FROM guardrail_policies
		WHERE enabled = 1
		ORDER BY CASE scope
			WHEN 'key' THEN 0 WHEN 'chain' THEN 1 WHEN 'model' THEN 2
			WHEN 'provider' THEN 3 ELSE 4 END ASC`)
}

func (r *GuardrailRepository) listExec(ctx context.Context, ex Executor, query string) ([]models.GuardrailPolicy, error) {
	rows, err := r.queryContext(ctx, ex, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	policies := []models.GuardrailPolicy{}
	for rows.Next() {
		p, err := scanGuardrailPolicy(rows)
		if err != nil {
			return nil, err
		}
		policies = append(policies, p)
	}
	return policies, errtrace.Wrap(rows.Err())
}

// Get returns one policy by id.
func (r *GuardrailRepository) Get(ctx context.Context, id string) (models.GuardrailPolicy, error) {
	return r.getExec(ctx, r.DB, id)
}

func (r *GuardrailRepository) getExec(ctx context.Context, ex Executor, id string) (models.GuardrailPolicy, error) {
	row := r.queryRowContext(ctx, ex, `SELECT `+guardrailColumns+` FROM guardrail_policies WHERE id = $1`, id)
	return scanGuardrailPolicy(row)
}

// Insert persists a new policy.
func (r *GuardrailRepository) Insert(ctx context.Context, p models.GuardrailPolicy) error {
	return r.insertExec(ctx, r.DB, p)
}

func (r *GuardrailRepository) insertExec(ctx context.Context, ex Executor, p models.GuardrailPolicy) error {
	_, err := r.execContext(ctx, ex, `
		INSERT INTO guardrail_policies (id, name, scope, target, protections, config, enabled)
		VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		p.ID, p.Name, p.Scope, p.Target, p.Protections, p.Config, p.Enabled,
	)
	return err
}

// Update rewrites a policy.
func (r *GuardrailRepository) Update(ctx context.Context, p models.GuardrailPolicy) error {
	return r.updateExec(ctx, r.DB, p)
}

func (r *GuardrailRepository) updateExec(ctx context.Context, ex Executor, p models.GuardrailPolicy) error {
	res, err := r.execContext(ctx, ex, `
		UPDATE guardrail_policies
		SET name = $2, scope = $3, target = $4, protections = $5, config = $6,
		    enabled = $7, updated_at = strftime('%Y-%m-%d %H:%M:%f+00:00', 'now')
		WHERE id = $1`,
		p.ID, p.Name, p.Scope, p.Target, p.Protections, p.Config, p.Enabled,
	)
	if err != nil {
		return err
	}
	return requireAffected(res, "guardrail policy")
}

// Delete removes one policy.
func (r *GuardrailRepository) Delete(ctx context.Context, id string) error {
	return r.deleteExec(ctx, r.DB, id)
}

func (r *GuardrailRepository) deleteExec(ctx context.Context, ex Executor, id string) error {
	res, err := r.execContext(ctx, ex, `DELETE FROM guardrail_policies WHERE id = $1`, id)
	if err != nil {
		return err
	}
	return requireAffected(res, "guardrail policy")
}

// AuditEntries returns recent guardrail audit rows, newest first.
func (r *GuardrailRepository) AuditEntries(ctx context.Context, limit int) ([]models.AuditEntry, error) {
	return r.auditEntriesExec(ctx, r.DB, limit)
}

func (r *GuardrailRepository) auditEntriesExec(ctx context.Context, ex Executor, limit int) ([]models.AuditEntry, error) {
	rows, err := r.queryContext(ctx, ex, `
		SELECT id, actor, action, target, detail, created_at
		FROM audit_entries WHERE action LIKE 'guardrail.%'
		ORDER BY created_at DESC LIMIT $1`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	entries := []models.AuditEntry{}
	for rows.Next() {
		var e models.AuditEntry
		if err := rows.Scan(&e.ID, &e.Actor, &e.Action, &e.Target, &e.Detail, &e.CreatedAt); err != nil {
			return nil, errtrace.Wrap(err)
		}
		entries = append(entries, e)
	}
	return entries, errtrace.Wrap(rows.Err())
}
