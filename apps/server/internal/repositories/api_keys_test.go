package repositories_test

import (
	"context"
	"path/filepath"
	"slices"
	"testing"
	"time"

	"tera-router/server/internal/config"
	"tera-router/server/internal/database"
	"tera-router/server/internal/migrator"
	"tera-router/server/internal/models"
	"tera-router/server/internal/repositories"

	"github.com/google/uuid"
)

// newKeyRepo opens a migrated temporary database and returns the key and plan
// repositories over it.
func newKeyRepo(t *testing.T) (*repositories.APIKeyRepository, *repositories.PlanRepository) {
	t.Helper()

	db, err := database.Open(filepath.Join(t.TempDir(), "keys_test.db"))
	if err != nil {
		t.Fatalf("open database: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })

	if err := migrator.Up(db, "../../migrations"); err != nil {
		t.Fatalf("migrate: %v", err)
	}

	repos := repositories.New(db, &config.ConfigApp{})
	return repos.APIKeys, repos.Plans
}

func TestAPIKeyAllowedModelsRoundTrip(t *testing.T) {
	keys, _ := newKeyRepo(t)
	ctx := context.Background()

	key := models.APIKey{
		ID:            uuid.NewString(),
		Name:          "restricted",
		KeyHash:       "hash",
		LookupHash:    "lookup-restricted",
		Display:       "tr_test…0000",
		AllowedModels: []string{"gpt-4o", "claude-*"},
	}
	if err := keys.Insert(ctx, key); err != nil {
		t.Fatalf("insert: %v", err)
	}

	stored, err := keys.Get(ctx, key.ID)
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if len(stored.AllowedModels) != 2 ||
		stored.AllowedModels[0] != "gpt-4o" || stored.AllowedModels[1] != "claude-*" {
		t.Fatalf("allowed models after insert = %v, want [gpt-4o claude-*]", stored.AllowedModels)
	}

	stored.AllowedModels = []string{"gpt-4o-mini"}
	if err := keys.Update(ctx, stored); err != nil {
		t.Fatalf("update: %v", err)
	}

	updated, err := keys.Get(ctx, key.ID)
	if err != nil {
		t.Fatalf("get after update: %v", err)
	}
	if len(updated.AllowedModels) != 1 || updated.AllowedModels[0] != "gpt-4o-mini" {
		t.Fatalf("allowed models after update = %v, want [gpt-4o-mini]", updated.AllowedModels)
	}
}

// A key with no allowlist must read back as empty, not nil, so the UI renders
// "no restriction" rather than a broken list.
func TestAPIKeyAllowedModelsDefaultsToEmpty(t *testing.T) {
	keys, _ := newKeyRepo(t)
	ctx := context.Background()

	key := models.APIKey{
		ID:         uuid.NewString(),
		Name:       "unrestricted",
		KeyHash:    "hash",
		LookupHash: "lookup-unrestricted",
		Display:    "tr_test…0001",
	}
	if err := keys.Insert(ctx, key); err != nil {
		t.Fatalf("insert: %v", err)
	}

	stored, err := keys.Get(ctx, key.ID)
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if len(stored.AllowedModels) != 0 {
		t.Fatalf("allowed models = %v, want empty", stored.AllowedModels)
	}
}

func TestAPIKeyGetWithPlanJoinsPlanFields(t *testing.T) {
	keys, plans := newKeyRepo(t)
	ctx := context.Background()

	plan := models.Plan{ID: uuid.NewString(), Name: "Team", Description: "Shared budget"}
	if err := plans.Insert(ctx, plan); err != nil {
		t.Fatalf("insert plan: %v", err)
	}

	key := models.APIKey{
		ID:         uuid.NewString(),
		PlanID:     &plan.ID,
		Name:       "with-plan",
		KeyHash:    "hash",
		LookupHash: "lookup-with-plan",
		Display:    "tr_plan…0002",
	}
	if err := keys.Insert(ctx, key); err != nil {
		t.Fatalf("insert key: %v", err)
	}

	detail, err := keys.GetWithPlan(ctx, key.ID)
	if err != nil {
		t.Fatalf("get with plan: %v", err)
	}
	if detail.PlanName == nil || *detail.PlanName != "Team" {
		t.Fatalf("plan name = %v, want Team", detail.PlanName)
	}
	if detail.PlanNote == nil || *detail.PlanNote != "Shared budget" {
		t.Fatalf("plan note = %v, want Shared budget", detail.PlanNote)
	}
}

// A key without a plan must still load, with nil plan fields rather than an
// error, so the detail page can render "No plan".
func TestAPIKeyGetWithPlanWithoutPlan(t *testing.T) {
	keys, _ := newKeyRepo(t)
	ctx := context.Background()

	key := models.APIKey{
		ID:         uuid.NewString(),
		Name:       "no-plan",
		KeyHash:    "hash",
		LookupHash: "lookup-no-plan",
		Display:    "tr_none…0003",
	}
	if err := keys.Insert(ctx, key); err != nil {
		t.Fatalf("insert key: %v", err)
	}

	detail, err := keys.GetWithPlan(ctx, key.ID)
	if err != nil {
		t.Fatalf("get with plan: %v", err)
	}
	if detail.PlanName != nil || detail.PlanNote != nil {
		t.Fatalf("plan fields = (%v, %v), want nil", detail.PlanName, detail.PlanNote)
	}
}

// List joins the plan too, so the new column must be scanned in the same order
// as the projection.
func TestAPIKeyListIncludesAllowedModelsAndPlan(t *testing.T) {
	keys, plans := newKeyRepo(t)
	ctx := context.Background()

	plan := models.Plan{ID: uuid.NewString(), Name: "Pro", Description: "Pro tier"}
	if err := plans.Insert(ctx, plan); err != nil {
		t.Fatalf("insert plan: %v", err)
	}
	key := models.APIKey{
		ID:            uuid.NewString(),
		PlanID:        &plan.ID,
		Name:          "listed",
		KeyHash:       "hash",
		LookupHash:    "lookup-listed",
		Display:       "tr_list…0004",
		AllowedModels: []string{"gpt-4o"},
	}
	if err := keys.Insert(ctx, key); err != nil {
		t.Fatalf("insert key: %v", err)
	}

	rows, total, err := keys.List(ctx, repositories.APIKeyFilter{}, 0, 10)
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if total != 1 || len(rows) != 1 {
		t.Fatalf("list returned %d rows (total %d), want 1", len(rows), total)
	}
	if len(rows[0].AllowedModels) != 1 || rows[0].AllowedModels[0] != "gpt-4o" {
		t.Fatalf("allowed models = %v, want [gpt-4o]", rows[0].AllowedModels)
	}
	if rows[0].PlanName == nil || *rows[0].PlanName != "Pro" {
		t.Fatalf("plan name = %v, want Pro", rows[0].PlanName)
	}
}

// TestAPIKeyListFilters pins the list filters the keys page sends: search over
// name, key preview and plan name, the status filter, the sort orders, and a
// total that follows the filters. StatusCounts ignores them.
func TestAPIKeyListFilters(t *testing.T) {
	keys, plans := newKeyRepo(t)
	ctx := context.Background()

	plan := models.Plan{ID: uuid.NewString(), Name: "Pro", Description: "Pro tier"}
	if err := plans.Insert(ctx, plan); err != nil {
		t.Fatalf("insert plan: %v", err)
	}
	base := time.Now().UTC().Truncate(time.Second)
	for i, k := range []models.APIKey{
		{Name: "zeta", Display: "tr_aaa…0001", PlanID: &plan.ID},
		{Name: "Alpha", Display: "tr_bbb…0002", Disabled: true},
		{Name: "beta", Display: "tr_ccc…0003"},
	} {
		k.ID = uuid.NewString()
		k.KeyHash = "hash-" + k.Name
		k.LookupHash = "lookup-" + k.Name
		if err := keys.Insert(ctx, k); err != nil {
			t.Fatalf("insert %s: %v", k.Name, err)
		}
		// Insert stamps created_at itself; space the rows so the order is known.
		if _, err := keys.DB.Exec(`UPDATE api_keys SET created_at = $2 WHERE id = $1`, k.ID, base.Add(time.Duration(i)*time.Minute)); err != nil {
			t.Fatalf("stamp %s: %v", k.Name, err)
		}
	}

	for _, tc := range []struct {
		name   string
		filter repositories.APIKeyFilter
		limit  int
		want   []string
		total  int
	}{
		{"newest first", repositories.APIKeyFilter{}, 10, []string{"beta", "Alpha", "zeta"}, 3},
		{"oldest first", repositories.APIKeyFilter{Sort: "oldest"}, 10, []string{"zeta", "Alpha", "beta"}, 3},
		{"by name", repositories.APIKeyFilter{Sort: "name"}, 10, []string{"Alpha", "beta", "zeta"}, 3},
		{"search name", repositories.APIKeyFilter{Search: "ALP"}, 10, []string{"Alpha"}, 1},
		{"search preview", repositories.APIKeyFilter{Search: "ccc"}, 10, []string{"beta"}, 1},
		{"search plan", repositories.APIKeyFilter{Search: "pro"}, 10, []string{"zeta"}, 1},
		{"search no plan", repositories.APIKeyFilter{Search: "no plan", Sort: "name"}, 10, []string{"Alpha", "beta"}, 2},
		{"disabled", repositories.APIKeyFilter{Status: "disabled"}, 10, []string{"Alpha"}, 1},
		{"active", repositories.APIKeyFilter{Status: "active", Sort: "name"}, 10, []string{"beta", "zeta"}, 2},
		{"page of filtered", repositories.APIKeyFilter{Sort: "name"}, 2, []string{"Alpha", "beta"}, 3},
	} {
		rows, total, err := keys.List(ctx, tc.filter, 0, tc.limit)
		if err != nil {
			t.Fatalf("%s: %v", tc.name, err)
		}
		got := make([]string, 0, len(rows))
		for _, r := range rows {
			got = append(got, r.Name)
		}
		if !slices.Equal(got, tc.want) || total != tc.total {
			t.Errorf("%s = %v (total %d), want %v (total %d)", tc.name, got, total, tc.want, tc.total)
		}
	}

	total, disabled, err := keys.StatusCounts(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if total != 3 || disabled != 1 {
		t.Errorf("StatusCounts = %d total, %d disabled; want 3, 1", total, disabled)
	}
}
