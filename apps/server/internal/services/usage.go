package services

import (
	"context"
	"time"

	"tera-router/server/internal/repositories"
)

// UsageService aggregates usage_records for the dashboard. Rows are
// populated by the gateway phase; endpoints return zeros until then.
type UsageService struct {
	repos *repositories.Repositories
}

// rangeStart resolves the window start for a named range (today, 7d, 30d)
// used by the quota and usage endpoints. Empty means all time.
func rangeStart(rng string) time.Time {
	now := time.Now()
	switch rng {
	case "today":
		return time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	case "7d":
		return now.Add(-7 * 24 * time.Hour)
	case "24h":
		return now.Add(-24 * time.Hour)
	default:
		return now.Add(-30 * 24 * time.Hour)
	}
}

// Summary totals the requested window.
func (s *UsageService) Summary(ctx context.Context, rng string) (repositories.UsageByModel, error) {
	summary, err := s.repos.Usage.Summary(ctx, rangeStart(rng))
	if err != nil {
		return repositories.UsageByModel{}, nil
	}
	return repositories.UsageByModel{
		Requests:         summary.ID,
		PromptTokens:     int64(summary.PromptTokens),
		CompletionTokens: int64(summary.CompletionTokens),
		CostMicros:       summary.CostMicros,
		AvgLatencyMS:     int64(summary.LatencyMS),
	}, nil
}

// ByModel returns the per-model breakdown.
func (s *UsageService) ByModel(ctx context.Context, rng string) ([]repositories.UsageByModel, error) {
	return s.repos.Usage.ByModel(ctx, rangeStart(rng))
}

// Insights returns the daily series plus model ranking for the dashboard.
func (s *UsageService) Insights(ctx context.Context, rng string) (map[string]any, error) {
	daily, err := s.repos.Usage.Daily(ctx, rangeStart(rng))
	if err != nil {
		return nil, err
	}
	byModel, err := s.repos.Usage.ByModel(ctx, rangeStart(rng))
	if err != nil {
		return nil, err
	}
	summary, err := s.Summary(ctx, rng)
	if err != nil {
		return nil, err
	}
	return map[string]any{
		"range":    rng,
		"summary":  summary,
		"daily":    daily,
		"by_model": byModel,
	}, nil
}

// ListRaw returns paginated raw usage rows (gateway feed; empty for now).
func (s *UsageService) ListRaw(ctx context.Context, offset, limit int) ([]map[string]any, int, error) {
	return []map[string]any{}, 0, nil
}
