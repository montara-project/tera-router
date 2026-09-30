package modelcatalog_test

import (
	"context"
	"errors"
	"path/filepath"
	"testing"

	"tera-router/server/internal/config"
	"tera-router/server/internal/database"
	"tera-router/server/internal/migrator"
	"tera-router/server/internal/modelcatalog"
	"tera-router/server/internal/repositories"
)

// newSettings opens a migrated temporary database and returns its settings
// repository.
func newSettings(t *testing.T) *repositories.SettingRepository {
	t.Helper()

	db, err := database.Open(filepath.Join(t.TempDir(), "modelcatalog_test.db"))
	if err != nil {
		t.Fatalf("open database: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })

	if err := migrator.Up(db, "../../migrations"); err != nil {
		t.Fatalf("migrate: %v", err)
	}

	return repositories.New(db, &config.ConfigApp{}).Settings
}

func TestStoreLoadRoundTrip(t *testing.T) {
	settings := newSettings(t)
	ctx := context.Background()

	cat, err := modelcatalog.Store(ctx, settings, "custom-openai-zrouter",
		[]string{"deepseek-v4.1-flash", "qwen3-max", "glm-5"})
	if err != nil {
		t.Fatalf("store: %v", err)
	}
	if cat.FetchedAt.IsZero() {
		t.Error("fetched_at must be set")
	}

	loaded, err := modelcatalog.Load(ctx, settings, "custom-openai-zrouter")
	if err != nil {
		t.Fatalf("load: %v", err)
	}
	if len(loaded.Models) != 3 {
		t.Fatalf("models = %d, want 3", len(loaded.Models))
	}
	for _, m := range loaded.Models {
		if m.State != modelcatalog.StateActive {
			t.Errorf("model %s state = %q, want active for a first sync", m.ID, m.State)
		}
	}
}

func TestDisabledPersistsAcrossSync(t *testing.T) {
	settings := newSettings(t)
	ctx := context.Background()

	if _, err := modelcatalog.Store(ctx, settings, "p", []string{"a", "b", "c"}); err != nil {
		t.Fatalf("store: %v", err)
	}
	if _, err := modelcatalog.SetStates(ctx, settings, "p", []modelcatalog.StateUpdate{
		{ID: "b", State: modelcatalog.StateDisabled},
	}); err != nil {
		t.Fatalf("set states: %v", err)
	}

	// A later sync that reshuffles the upstream list must keep b disabled —
	// even when it vanished upstream — and leave the others active.
	cat, err := modelcatalog.Store(ctx, settings, "p", []string{"c", "a", "d"})
	if err != nil {
		t.Fatalf("store: %v", err)
	}
	states := map[string]string{}
	for _, m := range cat.Models {
		states[m.ID] = m.State
	}
	if states["b"] != modelcatalog.StateDisabled {
		t.Errorf("b state = %q, want disabled to persist across syncs", states["b"])
	}
	if states["d"] != modelcatalog.StateActive {
		t.Errorf("d state = %q, want active for a newly discovered model", states["d"])
	}
	if len(cat.Models) != 4 {
		t.Errorf("models = %d, want 4 (a, b kept-disabled, c, d)", len(cat.Models))
	}
}

func TestSetStatesRoundTrip(t *testing.T) {
	settings := newSettings(t)
	ctx := context.Background()

	if _, err := modelcatalog.Store(ctx, settings, "p", []string{"a", "b"}); err != nil {
		t.Fatalf("store: %v", err)
	}
	if _, err := modelcatalog.SetStates(ctx, settings, "p", []modelcatalog.StateUpdate{
		{ID: "a", State: modelcatalog.StateDisabled},
		{ID: "b", State: modelcatalog.StateActive},
	}); err != nil {
		t.Fatalf("set states: %v", err)
	}

	cat, err := modelcatalog.Load(ctx, settings, "p")
	if err != nil {
		t.Fatalf("load: %v", err)
	}
	for _, m := range cat.Models {
		want := modelcatalog.StateDisabled
		if m.ID == "b" {
			want = modelcatalog.StateActive
		}
		if m.State != want {
			t.Errorf("model %s state = %q, want %q", m.ID, m.State, want)
		}
	}
}

func TestSetStatesUnknownModel(t *testing.T) {
	settings := newSettings(t)
	ctx := context.Background()

	if _, err := modelcatalog.Store(ctx, settings, "p", []string{"a"}); err != nil {
		t.Fatalf("store: %v", err)
	}
	if _, err := modelcatalog.SetStates(ctx, settings, "p", []modelcatalog.StateUpdate{
		{ID: "nope", State: modelcatalog.StateActive},
	}); !errors.Is(err, modelcatalog.ErrUnknownModel) {
		t.Fatalf("err = %v, want ErrUnknownModel", err)
	}
}

func TestSetStatesInvalidState(t *testing.T) {
	settings := newSettings(t)
	ctx := context.Background()

	if _, err := modelcatalog.Store(ctx, settings, "p", []string{"a"}); err != nil {
		t.Fatalf("store: %v", err)
	}
	if _, err := modelcatalog.SetStates(ctx, settings, "p", []modelcatalog.StateUpdate{
		{ID: "a", State: "enabled"},
	}); !errors.Is(err, modelcatalog.ErrInvalidState) {
		t.Fatalf("err = %v, want ErrInvalidState", err)
	}
}

func TestLoadNoCatalog(t *testing.T) {
	settings := newSettings(t)
	ctx := context.Background()

	if _, err := modelcatalog.Load(ctx, settings, "custom-openai-zrouter"); !errors.Is(err, modelcatalog.ErrNoCatalog) {
		t.Fatalf("err = %v, want ErrNoCatalog for a provider that was never synced", err)
	}
}

func TestCorruptBlobIsNoCatalog(t *testing.T) {
	settings := newSettings(t)
	ctx := context.Background()

	if err := settings.Upsert(ctx, modelcatalog.SettingsKey("custom-openai-zrouter"), `{"version":99,"models":[]}`); err != nil {
		t.Fatalf("upsert: %v", err)
	}
	if _, err := modelcatalog.Load(ctx, settings, "custom-openai-zrouter"); !errors.Is(err, modelcatalog.ErrNoCatalog) {
		t.Fatalf("err = %v, want ErrNoCatalog for an incompatible blob version", err)
	}
}

func TestVersion1BlobMigrates(t *testing.T) {
	settings := newSettings(t)
	ctx := context.Background()

	// A v1 blob stored plain ids with no per-model state.
	if err := settings.Upsert(ctx, modelcatalog.SettingsKey("p"),
		`{"version":1,"fetched_at":"2026-01-01T00:00:00Z","models":["a","b"]}`); err != nil {
		t.Fatalf("upsert: %v", err)
	}

	cat, err := modelcatalog.Load(ctx, settings, "p")
	if err != nil {
		t.Fatalf("load: %v", err)
	}
	if len(cat.Models) != 2 {
		t.Fatalf("models = %d, want 2", len(cat.Models))
	}
	for _, m := range cat.Models {
		if m.State != modelcatalog.StateActive {
			t.Errorf("migrated model %s state = %q, want active", m.ID, m.State)
		}
	}
}

func TestStoreReplacesPreviousCatalog(t *testing.T) {
	settings := newSettings(t)
	ctx := context.Background()

	if _, err := modelcatalog.Store(ctx, settings, "p", []string{"a", "b"}); err != nil {
		t.Fatalf("store: %v", err)
	}
	cat, err := modelcatalog.Store(ctx, settings, "p", []string{"c"})
	if err != nil {
		t.Fatalf("store: %v", err)
	}
	if len(cat.Models) != 1 || cat.Models[0].ID != "c" {
		t.Errorf("models = %+v, want the replacement list", cat.Models)
	}
}
