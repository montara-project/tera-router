package handlers

import (
	"context"
	"path/filepath"
	"testing"

	"tera-router/server/internal/app"
	"tera-router/server/internal/config"
	"tera-router/server/internal/database"
	"tera-router/server/internal/migrator"
	"tera-router/server/internal/models"
	"tera-router/server/internal/repositories"
	"tera-router/server/internal/services"
)

// newPricingHarness opens a migrated temporary database and a providers
// handler over it, for exercising the pricing import helper against real rows.
func newPricingHarness(t *testing.T) (*providersHandler, *repositories.Repositories) {
	t.Helper()

	db, err := database.Open(filepath.Join(t.TempDir(), "pricing_import_test.db"))
	if err != nil {
		t.Fatalf("open database: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })

	if err := migrator.Up(db, "../../migrations"); err != nil {
		t.Fatalf("migrate: %v", err)
	}

	repos := repositories.New(db, &config.ConfigApp{})
	return &providersHandler{app: &app.Application{Repos: repos}}, repos
}

// TestImportUpstreamPricing pins the sync-time pricing import contract: rates
// are created only for models the upstream prices AND that have no override
// yet, so an operator-set price is never clobbered by a sync.
func TestImportUpstreamPricing(t *testing.T) {
	h, repos := newPricingHarness(t)
	ctx := context.Background()

	if err := repos.Pricing.Upsert(ctx, models.PricingOverride{
		ID:          "existing",
		Provider:    "custom-openai-zrouter",
		Model:       "a",
		InputMicros: 999, // operator-set price that must survive
	}); err != nil {
		t.Fatalf("seed override: %v", err)
	}

	upstream := []services.UpstreamModel{
		// Already priced: skipped even though the upstream differs.
		{ID: "a", Pricing: &services.UpstreamPricing{InputMicros: 1, OutputMicros: 2}},
		// Priced and missing: imported.
		{ID: "b", Pricing: &services.UpstreamPricing{InputMicros: 2_500_000, OutputMicros: 10_000_000}},
		// Unpriced upstream: skipped.
		{ID: "c"},
	}

	imported, err := h.importUpstreamPricing(ctx, "custom-openai-zrouter", upstream)
	if err != nil {
		t.Fatalf("import: %v", err)
	}
	if imported != 1 {
		t.Fatalf("imported = %d, want 1", imported)
	}

	untouched, err := repos.Pricing.Get(ctx, "custom-openai-zrouter", "a")
	if err != nil {
		t.Fatalf("get a: %v", err)
	}
	if untouched.InputMicros != 999 {
		t.Errorf("a input = %d, want the operator's 999 to survive a sync", untouched.InputMicros)
	}

	created, err := repos.Pricing.Get(ctx, "custom-openai-zrouter", "b")
	if err != nil {
		t.Fatalf("get b: %v", err)
	}
	if created.InputMicros != 2_500_000 || created.OutputMicros != 10_000_000 {
		t.Errorf("b rates = %+v, want the upstream rates", created)
	}

	if _, err := repos.Pricing.Get(ctx, "custom-openai-zrouter", "c"); err == nil {
		t.Error("c has no upstream pricing and must get no override")
	}
}
