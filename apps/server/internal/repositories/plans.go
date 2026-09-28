package repositories

import (
	"context"
	"database/sql"
	"fmt"

	"tera-router/server/internal/lib/apperr"
	"tera-router/server/internal/models"
)

type PlanRepository struct {
	db *sql.DB
}

func requireAffected(res sql.Result, what string) error {
	n, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if n == 0 {
		return fmt.Errorf("%w: %s", apperr.ErrNotFound, what)
	}
	return nil
}

const planColumns = `
	id, name, description, limit_micros, limit_tokens, period, alert_pct, hard_cutoff,
	allowed_models, rpm, tpm, concurrent, created_at, updated_at`

func scanPlan(row interface{ Scan(...any) error }) (models.Plan, error) {
	var p models.Plan
	err := row.Scan(
		&p.ID, &p.Name, &p.Description, &p.LimitMicros, &p.LimitTokens, &p.Period, &p.AlertPct,
		&p.HardCutoff, (*jsonStrings)(&p.AllowedModels), &p.RPM, &p.TPM, &p.Concurrent,
		&p.CreatedAt, &p.UpdatedAt,
	)
	return p, translateNotFound(err)
}

func (r *PlanRepository) Create(ctx context.Context, p models.Plan) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO plans (id, name, description, limit_micros, limit_tokens, period, alert_pct, hard_cutoff, allowed_models, rpm, tpm, concurrent)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
		p.ID, p.Name, p.Description, p.LimitMicros, p.LimitTokens, p.Period, p.AlertPct,
		p.HardCutoff, jsonStrings(p.AllowedModels), p.RPM, p.TPM, p.Concurrent,
	)
	return err
}

func (r *PlanRepository) List(ctx context.Context) ([]models.Plan, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT`+planColumns+` FROM plans ORDER BY created_at DESC`)
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
	return plans, rows.Err()
}

func (r *PlanRepository) FindByID(ctx context.Context, id string) (models.Plan, error) {
	row := r.db.QueryRowContext(ctx, `SELECT`+planColumns+` FROM plans WHERE id = $1`, id)
	return scanPlan(row)
}

func (r *PlanRepository) Update(ctx context.Context, p models.Plan) error {
	res, err := r.db.ExecContext(ctx, `
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

func (r *PlanRepository) Delete(ctx context.Context, id string) error {
	res, err := r.db.ExecContext(ctx, `DELETE FROM plans WHERE id = $1`, id)
	if err != nil {
		return err
	}
	return requireAffected(res, "plan")
}
