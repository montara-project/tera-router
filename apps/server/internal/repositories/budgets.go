package repositories

import (
	"context"
	"database/sql"

	"tera-router/server/internal/models"
)

type BudgetRepository struct {
	db *sql.DB
}

const budgetColumns = `
	id, scope_kind, scope_id, limit_micros, limit_tokens, period, alert_pct, hard_cutoff,
	remaining_tokens, remaining_micros, period_bucket, created_at, updated_at`

func scanBudget(row interface{ Scan(...any) error }) (models.Budget, error) {
	var b models.Budget
	err := row.Scan(
		&b.ID, &b.ScopeKind, &b.ScopeID, &b.LimitMicros, &b.LimitTokens, &b.Period, &b.AlertPct,
		&b.HardCutoff, &b.RemainingTokens, &b.RemainingMicros, &b.PeriodBucket,
		&b.CreatedAt, &b.UpdatedAt,
	)
	return b, translateNotFound(err)
}

func (r *BudgetRepository) Create(ctx context.Context, b models.Budget) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO budgets (id, scope_kind, scope_id, limit_micros, limit_tokens, period, alert_pct, hard_cutoff, remaining_tokens, remaining_micros, period_bucket)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
		b.ID, b.ScopeKind, b.ScopeID, b.LimitMicros, b.LimitTokens, b.Period, b.AlertPct,
		b.HardCutoff, b.RemainingTokens, b.RemainingMicros, b.PeriodBucket,
	)
	return err
}

func (r *BudgetRepository) List(ctx context.Context) ([]models.Budget, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT`+budgetColumns+` FROM budgets ORDER BY created_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	budgets := []models.Budget{}
	for rows.Next() {
		b, err := scanBudget(rows)
		if err != nil {
			return nil, err
		}
		budgets = append(budgets, b)
	}
	return budgets, rows.Err()
}

func (r *BudgetRepository) FindByID(ctx context.Context, id string) (models.Budget, error) {
	row := r.db.QueryRowContext(ctx, `SELECT`+budgetColumns+` FROM budgets WHERE id = $1`, id)
	return scanBudget(row)
}

func (r *BudgetRepository) Update(ctx context.Context, b models.Budget) error {
	res, err := r.db.ExecContext(ctx, `
		UPDATE budgets
		SET scope_kind = $2, scope_id = $3, limit_micros = $4, limit_tokens = $5, period = $6,
		    alert_pct = $7, hard_cutoff = $8, remaining_tokens = $9, remaining_micros = $10,
		    period_bucket = $11, updated_at = strftime('%Y-%m-%d %H:%M:%f+00:00', 'now')
		WHERE id = $1`,
		b.ID, b.ScopeKind, b.ScopeID, b.LimitMicros, b.LimitTokens, b.Period,
		b.AlertPct, b.HardCutoff, b.RemainingTokens, b.RemainingMicros, b.PeriodBucket,
	)
	if err != nil {
		return err
	}
	return requireAffected(res, "budget")
}

func (r *BudgetRepository) Delete(ctx context.Context, id string) error {
	res, err := r.db.ExecContext(ctx, `DELETE FROM budgets WHERE id = $1`, id)
	if err != nil {
		return err
	}
	return requireAffected(res, "budget")
}
