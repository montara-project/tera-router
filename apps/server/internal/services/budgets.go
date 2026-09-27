package services

import (
	"context"
	"time"

	"tera-router/server/internal/models"
	"tera-router/server/internal/repositories"

	"github.com/google/uuid"
)

// periodWindow resolves the current period bucket and the window start for
// a budget period (daily/weekly/monthly), ported from IDRouter's budget
// engine.
func periodWindow(period string, now time.Time) (bucket string, from time.Time) {
	switch period {
	case "daily":
		start := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
		return start.Format("2006-01-02"), start
	case "weekly":
		weekday := int(now.Weekday())
		if weekday == 0 {
			weekday = 7
		}
		start := time.Date(now.Year(), now.Month(), now.Day()-weekday+1, 0, 0, 0, 0, now.Location())
		return start.Format("2006-01-02"), start
	default: // monthly
		start := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
		return start.Format("2006-01"), start
	}
}

type BudgetService struct {
	repos *repositories.Repositories
	audit *AuditService
}

func (s *BudgetService) Create(ctx context.Context, actor string, b models.Budget) (models.Budget, error) {
	b.ID = uuid.NewString()
	bucket, _ := periodWindow(b.Period, time.Now())
	b.PeriodBucket = bucket
	if b.LimitMicros > 0 {
		b.RemainingMicros = b.LimitMicros
	}
	if b.LimitTokens > 0 {
		b.RemainingTokens = b.LimitTokens
	}

	if err := s.repos.Budgets.Create(ctx, b); err != nil {
		return models.Budget{}, err
	}
	s.audit.Record(ctx, actor, "budget.create", b.ID, map[string]string{"scope": string(b.ScopeKind)})
	return b, nil
}

func (s *BudgetService) List(ctx context.Context) ([]models.Budget, error) {
	return s.repos.Budgets.List(ctx)
}

func (s *BudgetService) Get(ctx context.Context, id string) (models.Budget, error) {
	b, err := s.repos.Budgets.FindByID(ctx, id)
	if err != nil {
		return models.Budget{}, err
	}
	return s.refreshAllocations(ctx, b)
}

// Update rewrites the budget and resets allocations to the new limits.
func (s *BudgetService) Update(ctx context.Context, actor string, b models.Budget) (models.Budget, error) {
	bucket, _ := periodWindow(b.Period, time.Now())
	b.PeriodBucket = bucket
	if b.LimitMicros > 0 {
		b.RemainingMicros = b.LimitMicros
	}
	if b.LimitTokens > 0 {
		b.RemainingTokens = b.LimitTokens
	}

	if err := s.repos.Budgets.Update(ctx, b); err != nil {
		return models.Budget{}, err
	}
	s.audit.Record(ctx, actor, "budget.update", b.ID, nil)
	return s.repos.Budgets.FindByID(ctx, b.ID)
}

func (s *BudgetService) Delete(ctx context.Context, actor, id string) error {
	if err := s.repos.Budgets.Delete(ctx, id); err != nil {
		return err
	}
	s.audit.Record(ctx, actor, "budget.delete", id, nil)
	return nil
}

// Status computes spend vs limit for every budget over its current period,
// refreshing lazy allocations when the bucket rolled over.
func (s *BudgetService) Status(ctx context.Context) ([]BudgetStatus, error) {
	budgets, err := s.repos.Budgets.List(ctx)
	if err != nil {
		return nil, err
	}

	out := make([]BudgetStatus, 0, len(budgets))
	for _, b := range budgets {
		b, err := s.refreshAllocations(ctx, b)
		if err != nil {
			return nil, err
		}

		_, from := periodWindow(b.Period, time.Now())
		spent, err := s.repos.Usage.Summary(ctx, from)
		if err != nil {
			return nil, err
		}

		status := BudgetStatus{Budget: b, SpentMicros: spent.CostMicros, SpentTokens: int64(spent.PromptTokens + spent.CompletionTokens)}
		status.SpendPct = percentOf(status.SpentMicros, b.LimitMicros)
		status.TokenPct = percentOf(status.SpentTokens, b.LimitTokens)
		out = append(out, status)
	}
	return out, nil
}

// refreshAllocations resets remaining counters when the period bucket rolled
// over (lazy reset, no background sweeper needed).
func (s *BudgetService) refreshAllocations(ctx context.Context, b models.Budget) (models.Budget, error) {
	bucket, _ := periodWindow(b.Period, time.Now())
	if b.PeriodBucket == bucket {
		return b, nil
	}

	b.PeriodBucket = bucket
	if b.LimitMicros > 0 {
		b.RemainingMicros = b.LimitMicros
	}
	if b.LimitTokens > 0 {
		b.RemainingTokens = b.LimitTokens
	}
	if err := s.repos.Budgets.Update(ctx, b); err != nil {
		return models.Budget{}, err
	}
	return b, nil
}

func percentOf(value, limit int64) float64 {
	if limit <= 0 {
		return 0
	}
	return float64(value) / float64(limit) * 100
}

// BudgetStatus is one row of the budgets/status endpoint.
type BudgetStatus struct {
	models.Budget
	SpentMicros int64   `json:"spent_micros"`
	SpentTokens int64   `json:"spent_tokens"`
	SpendPct    float64 `json:"spend_pct"`
	TokenPct    float64 `json:"token_pct"`
}
