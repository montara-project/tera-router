package repositories

import (
	"context"

	"tera-router/server/internal/models"

	"braces.dev/errtrace"
)

// BudgetRepository manages spend/token budgets per scope.
type BudgetRepository struct {
	BaseRepository
}

const budgetColumns = `
	id, scope_kind, scope_id, limit_micros, limit_tokens, period, alert_pct, hard_cutoff,
	remaining_tokens, remaining_micros, period_bucket, created_at, updated_at`

func scanBudget(row rowScanner) (models.Budget, error) {
	var b models.Budget
	err := row.Scan(
		&b.ID, &b.ScopeKind, &b.ScopeID, &b.LimitMicros, &b.LimitTokens, &b.Period, &b.AlertPct,
		&b.HardCutoff, &b.RemainingTokens, &b.RemainingMicros, &b.PeriodBucket,
		&b.CreatedAt, &b.UpdatedAt,
	)
	return b, translateNotFound(err)
}

// Insert persists a new budget.
func (r *BudgetRepository) Insert(ctx context.Context, b models.Budget) error {
	return r.insertExec(ctx, r.DB, b)
}

func (r *BudgetRepository) insertExec(ctx context.Context, ex Executor, b models.Budget) error {
	_, err := r.execContext(ctx, ex, `
		INSERT INTO budgets (id, scope_kind, scope_id, limit_micros, limit_tokens, period, alert_pct, hard_cutoff, remaining_tokens, remaining_micros, period_bucket)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
		b.ID, b.ScopeKind, b.ScopeID, b.LimitMicros, b.LimitTokens, b.Period, b.AlertPct,
		b.HardCutoff, b.RemainingTokens, b.RemainingMicros, b.PeriodBucket,
	)
	return err
}

// List returns every budget, newest first.
func (r *BudgetRepository) List(ctx context.Context) ([]models.Budget, error) {
	return r.listExec(ctx, r.DB)
}

func (r *BudgetRepository) listExec(ctx context.Context, ex Executor) ([]models.Budget, error) {
	rows, err := r.queryContext(ctx, ex, `SELECT`+budgetColumns+` FROM budgets ORDER BY created_at DESC`)
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
	return budgets, errtrace.Wrap(rows.Err())
}

// Get returns one budget by id.
func (r *BudgetRepository) Get(ctx context.Context, id string) (models.Budget, error) {
	return r.getExec(ctx, r.DB, id)
}

func (r *BudgetRepository) getExec(ctx context.Context, ex Executor, id string) (models.Budget, error) {
	row := r.queryRowContext(ctx, ex, `SELECT`+budgetColumns+` FROM budgets WHERE id = $1`, id)
	return scanBudget(row)
}

// Update rewrites a budget, including its remaining allowance and period
// bucket (the quota reset path).
func (r *BudgetRepository) Update(ctx context.Context, b models.Budget) error {
	return r.updateExec(ctx, r.DB, b)
}

func (r *BudgetRepository) updateExec(ctx context.Context, ex Executor, b models.Budget) error {
	res, err := r.execContext(ctx, ex, `
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

// Delete removes one budget.
func (r *BudgetRepository) Delete(ctx context.Context, id string) error {
	return r.deleteExec(ctx, r.DB, id)
}

func (r *BudgetRepository) deleteExec(ctx context.Context, ex Executor, id string) error {
	res, err := r.execContext(ctx, ex, `DELETE FROM budgets WHERE id = $1`, id)
	if err != nil {
		return err
	}
	return requireAffected(res, "budget")
}
