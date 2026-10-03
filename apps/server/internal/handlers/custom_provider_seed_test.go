package handlers

import (
	"context"
	"path/filepath"
	"testing"

	"tera-router/server/internal/app"
	"tera-router/server/internal/catalog"
	"tera-router/server/internal/config"
	"tera-router/server/internal/database"
	"tera-router/server/internal/dtos"
	"tera-router/server/internal/migrator"
	"tera-router/server/internal/models"
	"tera-router/server/internal/repositories"
)

// newSeedHarness opens a migrated temporary database and an application
// container over it, for exercising the connect-time custom-provider seeding
// against real rows.
func newSeedHarness(t *testing.T) (*app.Application, *repositories.Repositories) {
	t.Helper()

	db, err := database.Open(filepath.Join(t.TempDir(), "provider_seed_test.db"))
	if err != nil {
		t.Fatalf("open database: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })

	if err := migrator.Up(db, "../../migrations"); err != nil {
		t.Fatalf("migrate: %v", err)
	}

	repos := repositories.New(db, &config.ConfigApp{})
	return &app.Application{Repos: repos}, repos
}

// TestEnsureCustomProviderRow pins the connect-time seeding contract: a
// seedable catalog provider gets one custom_providers row carrying the
// catalog spec's identity, idempotent across repeated connects, while
// non-seedable slugs (unknown or subscription-only) never seed.
func TestEnsureCustomProviderRow(t *testing.T) {
	a, repos := newSeedHarness(t)
	ctx := context.Background()

	row, err := ensureCustomProviderRow(ctx, a, "tester", "openrouter")
	if err != nil {
		t.Fatalf("ensure openrouter: %v", err)
	}
	if row == nil {
		t.Fatal("expected a seeded row for openrouter")
	}
	if row.Name != "OpenRouter" || row.BaseURL != "https://openrouter.ai/api/v1" {
		t.Errorf("seeded row = %q / %q, want the catalog spec identity", row.Name, row.BaseURL)
	}
	if row.APIKind != "openai" || !row.Enabled {
		t.Errorf("seeded row api_kind = %q enabled = %v, want openai + enabled", row.APIKind, row.Enabled)
	}
	stored, err := repos.Providers.GetBySlug(ctx, "openrouter")
	if err != nil {
		t.Fatalf("get by slug: %v", err)
	}
	if stored.ID != row.ID {
		t.Errorf("stored id = %q, want the seeded %q", stored.ID, row.ID)
	}

	// A repeat connect finds the row and must not duplicate it.
	if row, err := ensureCustomProviderRow(ctx, a, "tester", "openrouter"); err != nil || row != nil {
		t.Errorf("repeat ensure = (%v, %v), want (nil, nil)", row, err)
	}
	all, err := repos.Providers.List(ctx)
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if len(all) != 1 {
		t.Errorf("custom provider count = %d, want 1", len(all))
	}

	// Unknown slugs and non-seedable catalog providers never seed.
	for _, slug := range []string{"my-own-relay", "codex"} {
		row, err := ensureCustomProviderRow(ctx, a, "tester", slug)
		if err != nil || row != nil {
			t.Errorf("ensure %q = (%v, %v), want (nil, nil)", slug, row, err)
		}
	}
	all, err = repos.Providers.List(ctx)
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if len(all) != 1 {
		t.Errorf("custom provider count = %d, want 1 after non-seedable ensures", len(all))
	}
}

// TestCatalogOverviewViews pins the providers-page identity rule: a
// custom_providers row sharing a catalog slug (seeded at connect) takes over
// the view's id and name so the detail page loads it from the database, while
// unconnected catalog providers keep their prov-<slug> identity.
func TestCatalogOverviewViews(t *testing.T) {
	listed := catalog.Listed()
	counts := map[string]int{"cline": 2}
	customBySlug := map[string]models.CustomProvider{
		"openrouter": {ID: "row-uuid", Name: "Renamed Router", Slug: "openrouter"},
	}

	connected, available := catalogOverviewViews(listed, counts, customBySlug)

	find := func(views []dtos.ProviderView, slug string) (dtos.ProviderView, bool) {
		for _, v := range views {
			if v.Slug == slug {
				return v, true
			}
		}
		return dtos.ProviderView{}, false
	}

	// The seeded row takes over the openrouter identity even with no accounts.
	view, ok := find(connected, "openrouter")
	if !ok {
		t.Fatal("openrouter with a seeded row must render as connected")
	}
	if view.ID != "row-uuid" || view.Name != "Renamed Router" {
		t.Errorf("openrouter view = %q / %q, want the custom row identity", view.ID, view.Name)
	}

	// Accounts alone connect a provider; the catalog identity stays.
	view, ok = find(connected, "cline")
	if !ok {
		t.Fatal("cline with accounts must render as connected")
	}
	if view.ID != "prov-cline" || view.Accounts != 2 {
		t.Errorf("cline view = %q / %d accounts, want prov-cline / 2", view.ID, view.Accounts)
	}

	// Without a row or accounts, the provider stays available on the catalog identity.
	if _, ok := find(available, "nvidia"); !ok {
		t.Error("nvidia without row or accounts must render as available")
	}
	if _, ok := find(connected, "nvidia"); ok {
		t.Error("nvidia must not render as connected")
	}
}
