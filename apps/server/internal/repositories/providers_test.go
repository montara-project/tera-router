package repositories_test

import (
	"context"
	"errors"
	"path/filepath"
	"testing"
	"time"

	"tera-router/server/internal/config"
	"tera-router/server/internal/database"
	"tera-router/server/internal/lib/apperr"
	"tera-router/server/internal/migrator"
	"tera-router/server/internal/models"
	"tera-router/server/internal/repositories"
)

// timeZero is the widest usage window start, so the test sees every row.
func timeZero() time.Time { return time.Unix(0, 0) }

// newProviderRepos opens a migrated temporary database and returns the
// repositories the provider cascade touches.
func newProviderRepos(t *testing.T) *repositories.Repositories {
	t.Helper()

	db, err := database.Open(filepath.Join(t.TempDir(), "provider_delete_test.db"))
	if err != nil {
		t.Fatalf("open database: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })

	if err := migrator.Up(db, "../../migrations"); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	return repositories.New(db, &config.ConfigApp{})
}

// seedProviderScoped inserts one provider plus every row scoped to its slug.
func seedProviderScoped(t *testing.T, repos *repositories.Repositories, id, slug string) {
	t.Helper()
	ctx := context.Background()

	if err := repos.Providers.Insert(ctx, models.CustomProvider{
		ID: id, Name: slug, Slug: slug, BaseURL: "https://" + slug + ".example/v1",
		APIKind: "openai", Pricing: "{}", Metadata: "{}", Enabled: true, Priority: 100,
	}); err != nil {
		t.Fatalf("insert provider: %v", err)
	}
	if err := repos.Accounts.Insert(ctx, models.Account{
		ID: "acc-" + slug, Provider: slug, Label: "key", AuthKind: models.AuthAPIKey,
		Secret: models.Sealed{WrappedDEK: "dek", Ciphertext: "ct"}, Metadata: "{}",
	}); err != nil {
		t.Fatalf("insert account: %v", err)
	}
	if err := repos.Pricing.Upsert(ctx, models.PricingOverride{
		ID: "price-" + slug, Provider: slug, Model: "m1", InputMicros: 1,
	}); err != nil {
		t.Fatalf("insert pricing: %v", err)
	}
	if err := repos.Capability.Upsert(ctx, models.CapabilityOverride{
		ID: "cap-" + slug, Provider: slug, Model: "m1", Capabilities: []string{"chat"},
	}); err != nil {
		t.Fatalf("insert capability: %v", err)
	}
	if err := repos.Settings.Upsert(ctx, repositories.ProviderModelsSettingsKey(slug),
		`{"version":2,"fetched_at":"2026-01-01T00:00:00Z","models":[{"id":"m1","state":"active"}]}`); err != nil {
		t.Fatalf("insert catalog: %v", err)
	}
}

func TestProviderDeleteCascadesScopedRows(t *testing.T) {
	repos := newProviderRepos(t)
	ctx := context.Background()

	seedProviderScoped(t, repos, "cp-a", "custom-openai-a")
	seedProviderScoped(t, repos, "cp-b", "custom-openai-b")

	result, err := repos.Providers.Delete(ctx, "cp-a")
	if err != nil {
		t.Fatalf("delete: %v", err)
	}
	if result.Slug != "custom-openai-a" {
		t.Errorf("slug = %q, want the deleted provider's slug", result.Slug)
	}
	if result.Accounts != 1 {
		t.Errorf("accounts = %d, want 1 (the report the UI shows)", result.Accounts)
	}

	// Every row scoped to the deleted provider is gone.
	if _, err := repos.Providers.Get(ctx, "cp-a"); !errors.Is(err, apperr.ErrNotFound) {
		t.Errorf("provider still readable: %v", err)
	}
	if _, err := repos.Accounts.Get(ctx, "acc-custom-openai-a"); !errors.Is(err, apperr.ErrNotFound) {
		t.Errorf("account still readable: %v", err)
	}
	if _, err := repos.Pricing.Get(ctx, "custom-openai-a", "m1"); !errors.Is(err, apperr.ErrNotFound) {
		t.Errorf("pricing override still readable: %v", err)
	}
	caps, err := repos.Capability.List(ctx)
	if err != nil {
		t.Fatalf("list capabilities: %v", err)
	}
	for _, c := range caps {
		if c.Provider == "custom-openai-a" {
			t.Errorf("capability override survived: %+v", c)
		}
	}
	if _, err := repos.Settings.Get(ctx, repositories.ProviderModelsSettingsKey("custom-openai-a")); !errors.Is(err, apperr.ErrNotFound) {
		t.Errorf("stored catalog survived: %v", err)
	}

	// The other provider is untouched.
	if _, err := repos.Providers.Get(ctx, "cp-b"); err != nil {
		t.Errorf("sibling provider was affected: %v", err)
	}
	if _, err := repos.Accounts.Get(ctx, "acc-custom-openai-b"); err != nil {
		t.Errorf("sibling account was affected: %v", err)
	}
	if _, err := repos.Pricing.Get(ctx, "custom-openai-b", "m1"); err != nil {
		t.Errorf("sibling pricing was affected: %v", err)
	}
}

// TestProviderDeleteKeepsUsageHistory pins the deliberate exception: usage
// records are the spend ledger and must survive the provider they ran on.
func TestProviderDeleteKeepsUsageHistory(t *testing.T) {
	repos := newProviderRepos(t)
	ctx := context.Background()

	seedProviderScoped(t, repos, "cp-a", "custom-openai-a")
	if err := repos.Usage.Insert(ctx, models.UsageRecord{
		Provider: "custom-openai-a", Model: "m1", PromptTokens: 10, CostMicros: 5,
		CreatedAt: time.Now(),
	}); err != nil {
		t.Fatalf("insert usage: %v", err)
	}

	if _, err := repos.Providers.Delete(ctx, "cp-a"); err != nil {
		t.Fatalf("delete: %v", err)
	}

	groups, err := repos.Usage.ByModelGrouped(ctx, timeZero())
	if err != nil {
		t.Fatalf("usage groups: %v", err)
	}
	found := false
	for _, g := range groups {
		if g.Provider == "custom-openai-a" && g.Model == "m1" {
			found = true
		}
	}
	if !found {
		t.Error("usage history was deleted with the provider; it must be kept")
	}
}

func TestProviderDeleteMissingIsNotFound(t *testing.T) {
	repos := newProviderRepos(t)

	if _, err := repos.Providers.Delete(context.Background(), "nope"); !errors.Is(err, apperr.ErrNotFound) {
		t.Fatalf("err = %v, want apperr.ErrNotFound", err)
	}
}
