package repositories

import (
	"context"

	"tera-router/server/internal/models"

	"braces.dev/errtrace"
)

// PlanRepository manages rate/spend plans bound to API keys.
type PlanRepository struct {
	BaseRepository
}

const planColumns = `
	id, name, description, limit_micros, limit_tokens, period, alert_pct, hard_cutoff,
	allowed_models, rpm, tpm, concurrent, created_at, updated_at`

func scanPlan(row rowScanner) (models.Plan, error) {
	var p models.Plan
	err := row.Scan(
		&p.ID, &p.Name, &p.Description, &p.LimitMicros, &p.LimitTokens, &p.Period, &p.AlertPct,
		&p.HardCutoff, (*jsonStrings)(&p.AllowedModels), &p.RPM, &p.TPM, &p.Concurrent,
		&p.CreatedAt, &p.UpdatedAt,
	)
	return p, translateNotFound(err)
}

// Insert persists a new plan.
func (r *PlanRepository) Insert(ctx context.Context, p models.Plan) error {
	return r.insertExec(ctx, p)
}

func (r *PlanRepository) insertExec(ctx context.Context, p models.Plan) error {
	_, err := r.execContext(ctx, r.DB, `
		INSERT INTO plans (id, name, description, limit_micros, limit_tokens, period, alert_pct, hard_cutoff, allowed_models, rpm, tpm, concurrent)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
		p.ID, p.Name, p.Description, p.LimitMicros, p.LimitTokens, p.Period, p.AlertPct,
		p.HardCutoff, jsonStrings(p.AllowedModels), p.RPM, p.TPM, p.Concurrent,
	)
	return err
}

// List returns every plan, newest first.
func (r *PlanRepository) List(ctx context.Context) ([]models.Plan, error) {
	return r.listExec(ctx)
}

func (r *PlanRepository) listExec(ctx context.Context) ([]models.Plan, error) {
	rows, err := r.queryContext(ctx, r.DB, `SELECT`+planColumns+` FROM plans ORDER BY created_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	plans := []models.Plan{}
	for rows.Next() {
		p, err := scanPlan(rows)
		if err != nil {
			return nil, err
		}
		plans = append(plans, p)
	}
	return plans, errtrace.Wrap(rows.Err())
}

// Get returns one plan by id.
func (r *PlanRepository) Get(ctx context.Context, id string) (models.Plan, error) {
	return r.getExec(ctx, id)
}

func (r *PlanRepository) getExec(ctx context.Context, id string) (models.Plan, error) {
	row := r.queryRowContext(ctx, r.DB, `SELECT`+planColumns+` FROM plans WHERE id = $1`, id)
	return scanPlan(row)
}

// Update rewrites a plan.
func (r *PlanRepository) Update(ctx context.Context, p models.Plan) error {
	return r.updateExec(ctx, p)
}

func (r *PlanRepository) updateExec(ctx context.Context, p models.Plan) error {
	res, err := r.execContext(ctx, r.DB, `
		UPDATE plans
		SET name = $2, description = $3, limit_micros = $4, limit_tokens = $5, period = $6,
		    alert_pct = $7, hard_cutoff = $8, allowed_models = $9, rpm = $10, tpm = $11, concurrent = $12, updated_at = strftime('%Y-%m-%d %H:%M:%f+00:00', 'now')
		WHERE id = $1`,
		p.ID, p.Name, p.Description, p.LimitMicros, p.LimitTokens, p.Period,
		p.AlertPct, p.HardCutoff, jsonStrings(p.AllowedModels), p.RPM, p.TPM, p.Concurrent,
	)
	if err != nil {
		return err
	}
	return requireAffected(res, "plan")
}

// Delete removes one plan.
func (r *PlanRepository) Delete(ctx context.Context, id string) error {
	return r.deleteExec(ctx, id)
}

func (r *PlanRepository) deleteExec(ctx context.Context, id string) error {
	res, err := r.execContext(ctx, r.DB, `DELETE FROM plans WHERE id = $1`, id)
	if err != nil {
		return err
	}
	return requireAffected(res, "plan")
}
