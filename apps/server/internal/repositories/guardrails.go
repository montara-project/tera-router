package repositories

import (
	"context"
	"database/sql"

	"tera-router/server/internal/models"
)

type GuardrailRepository struct {
	db *sql.DB
}

const guardrailColumns = `id, name, scope, target, protections, config, enabled, created_at, updated_at`

func scanGuardrailPolicy(row interface{ Scan(...any) error }) (models.GuardrailPolicy, error) {
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
	rows, err := r.db.QueryContext(ctx, `
		SELECT `+guardrailColumns+` FROM guardrail_policies
		ORDER BY (scope = 'global') DESC, created_at DESC`)
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
	return policies, rows.Err()
}

// ListEnabled returns the enabled policies used for evaluation, ordered by
// scope specificity: key first, then chain, model, provider, and global as
// the last-resort master policy.
func (r *GuardrailRepository) ListEnabled(ctx context.Context) ([]models.GuardrailPolicy, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT `+guardrailColumns+` FROM guardrail_policies
		WHERE enabled = 1
		ORDER BY CASE scope
			WHEN 'key' THEN 0 WHEN 'chain' THEN 1 WHEN 'model' THEN 2
			WHEN 'provider' THEN 3 ELSE 4 END ASC`)
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
	return policies, rows.Err()
}

func (r *GuardrailRepository) Create(ctx context.Context, p models.GuardrailPolicy) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO guardrail_policies (id, name, scope, target, protections, config, enabled)
		VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		p.ID, p.Name, p.Scope, p.Target, p.Protections, p.Config, p.Enabled,
	)
	return err
}

func (r *GuardrailRepository) Update(ctx context.Context, p models.GuardrailPolicy) error {
	res, err := r.db.ExecContext(ctx, `
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

func (r *GuardrailRepository) Delete(ctx context.Context, id string) error {
	res, err := r.db.ExecContext(ctx, `DELETE FROM guardrail_policies WHERE id = $1`, id)
	if err != nil {
		return err
	}
	return requireAffected(res, "guardrail policy")
}

// AuditEntries returns recent guardrail audit rows, newest first.
func (r *GuardrailRepository) AuditEntries(ctx context.Context, limit int) ([]models.AuditEntry, error) {
	rows, err := r.db.QueryContext(ctx, `
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
			return nil, err
		}
		entries = append(entries, e)
	}
	return entries, rows.Err()
}
