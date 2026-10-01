package repositories_test

import (
	"context"
	"path/filepath"
	"testing"

	"tera-router/server/internal/config"
	"tera-router/server/internal/database"
	"tera-router/server/internal/migrator"
	"tera-router/server/internal/models"
	"tera-router/server/internal/repositories"
)

// newPricingRepo opens a migrated temporary database and returns a pricing
// repository over it.
func newPricingRepo(t *testing.T) *repositories.PricingRepository {
	t.Helper()

	db, err := database.Open(filepath.Join(t.TempDir(), "pricing_test.db"))
	if err != nil {
		t.Fatalf("open database: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })

	if err := migrator.Up(db, "../../migrations"); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	return repositories.New(db, &config.ConfigApp{}).Pricing
}

func TestPricingOverrideRoundtripsReasoningAndTokenRate(t *testing.T) {
	repo := newPricingRepo(t)
	rate := 2.5
	err := repo.Upsert(context.Background(), models.PricingOverride{
		ID:                   "po-1",
		Provider:             "openai",
		Model:                "o3",
		InputMicros:          2_000_000,
		OutputMicros:         8_000_000,
		CacheReadMicros:      500_000,
		CacheWriteMicros:     2_000_000,
		ReasoningMicros:      8_000_000,
		TokenConsumptionRate: &rate,
	})
	if err != nil {
		t.Fatalf("upsert: %v", err)
	}

	got, err := repo.Get(context.Background(), "openai", "o3")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if got.ReasoningMicros != 8_000_000 {
		t.Fatalf("ReasoningMicros = %d, want 8_000_000", got.ReasoningMicros)
	}
	if got.TokenConsumptionRate == nil || *got.TokenConsumptionRate != 2.5 {
		t.Fatalf("TokenConsumptionRate = %v, want 2.5", got.TokenConsumptionRate)
	}
}

// An explicit zero rate means "drains no token budget" and must survive the
// roundtrip — it is semantically different from NULL (no override: 1:1).
func TestPricingOverrideExplicitZeroTokenRateSurvives(t *testing.T) {
	repo := newPricingRepo(t)
	err := repo.Upsert(context.Background(), models.PricingOverride{
		ID:                   "po-1",
		Provider:             "glm",
		Model:                "glm-4-flash",
		TokenConsumptionRate: new(float64),
	})
	if err != nil {
		t.Fatalf("upsert: %v", err)
	}

	got, err := repo.Get(context.Background(), "glm", "glm-4-flash")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if got.TokenConsumptionRate == nil || *got.TokenConsumptionRate != 0 {
		t.Fatalf("TokenConsumptionRate = %v, want explicit 0", got.TokenConsumptionRate)
	}
}

func TestPricingOverrideWithoutTokenRateStaysNull(t *testing.T) {
	repo := newPricingRepo(t)
	err := repo.Upsert(context.Background(), models.PricingOverride{
		ID: "po-1", Provider: "openai", Model: "gpt-4o", OutputMicros: 10_000_000,
	})
	if err != nil {
		t.Fatalf("upsert: %v", err)
	}

	got, err := repo.Get(context.Background(), "openai", "gpt-4o")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if got.TokenConsumptionRate != nil {
		t.Fatalf("TokenConsumptionRate = %v, want nil (no override: 1:1)", got.TokenConsumptionRate)
	}
}

func TestPricingOverrideUpsertReplacesAllFields(t *testing.T) {
	repo := newPricingRepo(t)
	ctx := context.Background()

	rate := 2.0
	first := models.PricingOverride{
		ID: "po-1", Provider: "deepseek", Model: "deepseek-reasoner",
		OutputMicros: 2_190_000, ReasoningMicros: 2_190_000, TokenConsumptionRate: &rate,
	}
	if err := repo.Upsert(ctx, first); err != nil {
		t.Fatalf("upsert first: %v", err)
	}

	second := models.PricingOverride{
		ID: "po-1", Provider: "deepseek", Model: "deepseek-reasoner",
		OutputMicros: 2_500_000,
	}
	if err := repo.Upsert(ctx, second); err != nil {
		t.Fatalf("upsert second: %v", err)
	}

	got, err := repo.Get(ctx, "deepseek", "deepseek-reasoner")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if got.OutputMicros != 2_500_000 {
		t.Fatalf("OutputMicros = %d, want 2_500_000", got.OutputMicros)
	}
	if got.ReasoningMicros != 0 {
		t.Fatalf("ReasoningMicros = %d, want 0 (cleared by second upsert)", got.ReasoningMicros)
	}
	if got.TokenConsumptionRate != nil {
		t.Fatalf("TokenConsumptionRate = %v, want nil (cleared by second upsert)", got.TokenConsumptionRate)
	}
}
