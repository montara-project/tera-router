package repositories_test

import (
	"context"
	"testing"
	"time"

	"tera-router/server/internal/models"
)

// Token budgets drain against the rate-scaled token count, not the raw one:
// a rate of 2 doubles the drain, an explicit 0 drains nothing, and rows
// without an override (NULL) drain 1:1. Raw sums and cost are never scaled.
func TestSumSinceScalesTokensByConsumptionRate(t *testing.T) {
	repo := newUsageRepo(t)
	from := time.Now().Add(-time.Hour)
	ctx := context.Background()

	rate2 := 2.0
	free := 0.0
	insert(t, repo, models.UsageRecord{
		Provider: "openai", Model: "o3", PromptTokens: 80_000, CompletionTokens: 20_000,
		TokenConsumptionRate: &rate2,
	})
	insert(t, repo, models.UsageRecord{
		Provider: "openai", Model: "gpt-4o", PromptTokens: 30_000, CompletionTokens: 20_000,
		CostMicros: 500,
	})
	insert(t, repo, models.UsageRecord{
		Provider: "glm", Model: "glm-4-flash", PromptTokens: 100_000,
		TokenConsumptionRate: &free,
	})

	spend, err := repo.SumSince(ctx, nil, from)
	if err != nil {
		t.Fatalf("sum since: %v", err)
	}
	if spend.BudgetTokens != 250_000 {
		t.Fatalf("BudgetTokens = %d, want 250_000 (2×100k + 1×50k + 0×100k)", spend.BudgetTokens)
	}
	if raw := spend.PromptTokens + spend.CompletionTokens; raw != 250_000 {
		t.Fatalf("raw token sums scaled: prompt %d + completion %d, want unscaled 250_000 total", spend.PromptTokens, spend.CompletionTokens)
	}
	if spend.CostMicros != 500 {
		t.Fatalf("CostMicros = %d, want 500 (never scaled)", spend.CostMicros)
	}
}

func TestUsageRecordRoundtripsConsumptionRate(t *testing.T) {
	repo := newUsageRepo(t)
	ctx := context.Background()

	rate := 1.5
	insert(t, repo, models.UsageRecord{
		Provider: "openai", Model: "o3", PromptTokens: 10,
		TokenConsumptionRate: &rate,
	})
	insert(t, repo, models.UsageRecord{
		Provider: "openai", Model: "gpt-4o", PromptTokens: 10,
	})

	rows, err := repo.Recent(ctx, 10)
	if err != nil {
		t.Fatalf("recent: %v", err)
	}
	if len(rows) != 2 {
		t.Fatalf("len(rows) = %d, want 2", len(rows))
	}
	byModel := map[string]models.UsageRecord{}
	for _, r := range rows {
		byModel[r.Model] = r
	}
	if got := byModel["o3"]; got.TokenConsumptionRate == nil || *got.TokenConsumptionRate != 1.5 {
		t.Fatalf("o3 rate = %v, want 1.5", got.TokenConsumptionRate)
	}
	if got := byModel["gpt-4o"]; got.TokenConsumptionRate != nil {
		t.Fatalf("gpt-4o rate = %v, want nil", got.TokenConsumptionRate)
	}
}
