package repositories_test

import (
	"context"
	"errors"
	"path/filepath"
	"testing"

	"tera-router/server/internal/config"
	"tera-router/server/internal/database"
	"tera-router/server/internal/lib/apperr"
	"tera-router/server/internal/migrator"
	"tera-router/server/internal/models"
	"tera-router/server/internal/repositories"
)

func TestAliasRename(t *testing.T) {
	db, err := database.Open(filepath.Join(t.TempDir(), "aliases_test.db"))
	if err != nil {
		t.Fatalf("open database: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	if err := migrator.Up(db, "../../migrations"); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	aliases := repositories.New(db, &config.ConfigApp{}).Aliases
	ctx := context.Background()

	target := func(id, aliasID string) []models.AliasTarget {
		return []models.AliasTarget{{ID: id, AliasID: aliasID, Position: 1, Provider: "openai", Model: "gpt-4o", Active: true}}
	}
	if err := aliases.Upsert(ctx, models.ModelAlias{ID: "a1", Name: "fast", Active: true, Targets: target("t1", "a1")}); err != nil {
		t.Fatalf("upsert fast: %v", err)
	}
	if err := aliases.Upsert(ctx, models.ModelAlias{ID: "a2", Name: "taken", Active: true, Targets: target("t2", "a2")}); err != nil {
		t.Fatalf("upsert taken: %v", err)
	}

	// The handler mints a fresh id per PUT; the rename must keep the stored row.
	if err := aliases.Rename(ctx, "fast", models.ModelAlias{ID: "new-id", Name: "quick", ContextWindow: 8192, Active: true, Targets: target("t3", "new-id")}); err != nil {
		t.Fatalf("rename: %v", err)
	}
	got, err := aliases.GetByName(ctx, "quick")
	if err != nil {
		t.Fatalf("get renamed: %v", err)
	}
	if got.ID != "a1" || got.ContextWindow != 8192 || len(got.Targets) != 1 {
		t.Fatalf("renamed alias = %+v, want id a1, context 8192, 1 target", got)
	}
	if _, err := aliases.GetByName(ctx, "fast"); !errors.Is(err, apperr.ErrNotFound) {
		t.Fatalf("old name lookup err = %v, want not found", err)
	}

	if err := aliases.Rename(ctx, "quick", models.ModelAlias{Name: "taken"}); err == nil {
		t.Fatal("rename onto an existing name succeeded, want conflict")
	}
	if err := aliases.Rename(ctx, "missing", models.ModelAlias{Name: "other"}); !errors.Is(err, apperr.ErrNotFound) {
		t.Fatalf("rename missing err = %v, want not found", err)
	}
}

// TestAliasGroup stores the group on insert and replaces it on the next PUT.
func TestAliasGroup(t *testing.T) {
	aliases := newProviderRepos(t).Aliases
	ctx := context.Background()

	if err := aliases.Upsert(ctx, models.ModelAlias{ID: "a1", Name: "fast", Group: "coding", Active: true}); err != nil {
		t.Fatalf("upsert: %v", err)
	}
	if err := aliases.Upsert(ctx, models.ModelAlias{ID: "a2", Name: "fast", Group: "chat", Active: true}); err != nil {
		t.Fatalf("re-upsert: %v", err)
	}
	list, err := aliases.List(ctx)
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if len(list) != 1 || list[0].Group != "chat" {
		t.Fatalf("aliases = %+v, want one alias in group chat", list)
	}
}
