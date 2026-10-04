package repositories_test

import (
	"context"
	"path/filepath"
	"strings"
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

// Page filters before paging: total counts the filtered set, search matches
// "<provider> <model>" case-insensitively, and scope splits per-model from
// provider-wide rows.
func TestPricingPageFiltersAndCounts(t *testing.T) {
	repo := newPricingRepo(t)
	ctx := context.Background()
	for i, row := range [][2]string{
		{"anthropic", "claude-haiku-4-5"},
		{"anthropic", "claude-sonnet-4-5"},
		{"anthropic", ""},
		{"openai", "gpt-4o"},
		{"openai", ""},
	} {
		if err := repo.Upsert(ctx, models.PricingOverride{ID: "po-" + string(rune('a'+i)), Provider: row[0], Model: row[1]}); err != nil {
			t.Fatalf("upsert: %v", err)
		}
	}

	ids := func(rows []models.PricingOverride) []string {
		out := []string{}
		for _, r := range rows {
			out = append(out, r.Provider+"/"+r.Model)
		}
		return out
	}
	for _, tc := range []struct {
		name          string
		filter        repositories.PricingFilter
		offset, limit int
		total         int
		want          []string
	}{
		{"first page", repositories.PricingFilter{}, 0, 2, 5, []string{"anthropic/", "anthropic/claude-haiku-4-5"}},
		{"second page", repositories.PricingFilter{}, 2, 2, 5, []string{"anthropic/claude-sonnet-4-5", "openai/"}},
		{"search spans provider and model", repositories.PricingFilter{Search: "ANTHROPIC CLAUDE-S"}, 0, 10, 1, []string{"anthropic/claude-sonnet-4-5"}},
		{"scope model", repositories.PricingFilter{Scope: "model"}, 0, 10, 3, []string{"anthropic/claude-haiku-4-5", "anthropic/claude-sonnet-4-5", "openai/gpt-4o"}},
		{"scope provider", repositories.PricingFilter{Scope: "provider"}, 0, 10, 2, []string{"anthropic/", "openai/"}},
		{"provider + scope", repositories.PricingFilter{Provider: "openai", Scope: "model"}, 0, 10, 1, []string{"openai/gpt-4o"}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			rows, total, err := repo.Page(ctx, tc.filter, tc.offset, tc.limit)
			if err != nil {
				t.Fatalf("page: %v", err)
			}
			if total != tc.total {
				t.Errorf("total = %d, want %d", total, tc.total)
			}
			if got := ids(rows); len(got) != len(tc.want) || strings.Join(got, ",") != strings.Join(tc.want, ",") {
				t.Errorf("rows = %v, want %v", got, tc.want)
			}
		})
	}
}
