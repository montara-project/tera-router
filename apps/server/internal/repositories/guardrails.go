package repositories

import (
	"context"
	"time"

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
	return r.listExec(ctx, `
		SELECT `+guardrailColumns+` FROM guardrail_policies
		ORDER BY (scope = 'global') DESC, created_at DESC`)
}

// ListEnabled returns the enabled policies used for evaluation, ordered by
// scope specificity: key first, then chain, model, provider, and global as
// the last-resort master policy. Within a scope the oldest policy wins.
func (r *GuardrailRepository) ListEnabled(ctx context.Context) ([]models.GuardrailPolicy, error) {
	return r.listExec(ctx, `
		SELECT `+guardrailColumns+` FROM guardrail_policies
		WHERE enabled = 1
		ORDER BY CASE scope
			WHEN 'key' THEN 0 WHEN 'chain' THEN 1 WHEN 'model' THEN 2
			WHEN 'provider' THEN 3 ELSE 4 END ASC, created_at ASC, id ASC`)
}

func (r *GuardrailRepository) listExec(ctx context.Context, query string) ([]models.GuardrailPolicy, error) {
	rows, err := r.queryContext(ctx, r.DB, query)
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

// Insert persists a new policy.
func (r *GuardrailRepository) Insert(ctx context.Context, p models.GuardrailPolicy) error {
	_, err := r.execContext(ctx, r.DB, `
		INSERT INTO guardrail_policies (id, name, scope, target, protections, config, enabled)
		VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		p.ID, p.Name, p.Scope, p.Target, p.Protections, p.Config, p.Enabled,
	)
	return err
}

// Update rewrites a policy.
func (r *GuardrailRepository) Update(ctx context.Context, p models.GuardrailPolicy) error {
	res, err := r.execContext(ctx, r.DB, `
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
	res, err := r.execContext(ctx, r.DB, `DELETE FROM guardrail_policies WHERE id = $1`, id)
	if err != nil {
		return err
	}
	return requireAffected(res, "guardrail policy")
}

// AuditEntries returns recent guardrail audit rows, newest first.
func (r *GuardrailRepository) AuditEntries(ctx context.Context, limit int) ([]models.AuditEntry, error) {
	rows, err := r.queryContext(ctx, r.DB, `
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

// GuardrailDecisions counts the non-allow guardrail decisions taken on one
// key's requests. Masked covers every PII masking strategy.
type GuardrailDecisions struct {
	Blocked int64 `json:"blocked"`
	Masked  int64 `json:"masked"`
	Warned  int64 `json:"warned"`
	Logged  int64 `json:"logged"`
}

// DecisionsForKey totals the gateway's guardrail audit rows for one key since
// from. Allowed requests write no row, so they are not counted here.
func (r *GuardrailRepository) DecisionsForKey(ctx context.Context, keyID string, from time.Time) (GuardrailDecisions, error) {
	row := r.queryRowContext(ctx, r.DB, `
		SELECT COALESCE(SUM(action = 'guardrail.block'), 0),
		       COALESCE(SUM(action IN ('guardrail.redact', 'guardrail.mask', 'guardrail.hash')), 0),
		       COALESCE(SUM(action = 'guardrail.warn'), 0),
		       COALESCE(SUM(action = 'guardrail.log'), 0)
		FROM audit_entries
		WHERE action LIKE 'guardrail.%'
		  AND json_extract(detail, '$.key_id') = $1
		  AND created_at >= $2`, keyID, from.UTC())

	var d GuardrailDecisions
	err := row.Scan(&d.Blocked, &d.Masked, &d.Warned, &d.Logged)
	return d, errtrace.Wrap(err)
}
