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

	models := []string{"deepseek-v4.1-flash", "qwen3-max", "glm-5"}
	if err := modelcatalog.Store(ctx, settings, "custom-openai-zrouter", models); err != nil {
		t.Fatalf("store: %v", err)
	}

	cat, err := modelcatalog.Load(ctx, settings, "custom-openai-zrouter")
	if err != nil {
		t.Fatalf("load: %v", err)
	}
	if len(cat.Models) != 3 || cat.Models[0] != "deepseek-v4.1-flash" {
		t.Errorf("models = %v, want the stored list", cat.Models)
	}
	if cat.FetchedAt.IsZero() {
		t.Error("fetched_at must be set")
	}
}

func TestLoadNoCatalog(t *testing.T) {
	settings := newSettings(t)
	ctx := context.Background()

	if _, err := modelcatalog.Load(ctx, settings, "custom-openai-zrouter"); !errors.Is(err, modelcatalog.ErrNoCatalog) {
		t.Fatalf("err = %v, want ErrNoCatalog for a provider that was never fetched", err)
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

func TestStoreReplacesPreviousCatalog(t *testing.T) {
	settings := newSettings(t)
	ctx := context.Background()

	if err := modelcatalog.Store(ctx, settings, "p", []string{"a", "b"}); err != nil {
		t.Fatalf("store: %v", err)
	}
	if err := modelcatalog.Store(ctx, settings, "p", []string{"c"}); err != nil {
		t.Fatalf("store: %v", err)
	}

	cat, err := modelcatalog.Load(ctx, settings, "p")
	if err != nil {
		t.Fatalf("load: %v", err)
	}
	if len(cat.Models) != 1 || cat.Models[0] != "c" {
		t.Errorf("models = %v, want the replacement list", cat.Models)
	}
}
