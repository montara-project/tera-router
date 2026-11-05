package repositories_test

import (
	"context"
	"errors"
	"testing"

	"tera-router/server/internal/lib/apperr"
	"tera-router/server/internal/models"
)

// TestPortalTokenLifecycle pins that issuing replaces the old link, revoking
// removes it, and deleting the key takes its token with it.
func TestPortalTokenLifecycle(t *testing.T) {
	repos := newProviderRepos(t)
	ctx := context.Background()
	key := models.APIKey{ID: "key-a", Name: "a", KeyHash: "h", LookupHash: "l", Display: "kr_a"}
	if err := repos.APIKeys.Insert(ctx, key); err != nil {
		t.Fatal(err)
	}

	if got, _ := repos.Portal.ForKey(ctx, key.ID); got != "" {
		t.Fatalf("new key token = %q, want none", got)
	}
	first, err := repos.Portal.Issue(ctx, key.ID)
	if err != nil {
		t.Fatal(err)
	}
	second, err := repos.Portal.Issue(ctx, key.ID)
	if err != nil {
		t.Fatal(err)
	}
	if first == second {
		t.Fatal("reissue kept the same token")
	}
	if _, err := repos.Portal.KeyID(ctx, first); !errors.Is(err, apperr.ErrNotFound) {
		t.Fatalf("old token resolves: %v", err)
	}
	if id, err := repos.Portal.KeyID(ctx, second); err != nil || id != key.ID {
		t.Fatalf("token resolves to %q, %v", id, err)
	}

	if err := repos.Portal.Revoke(ctx, key.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := repos.Portal.KeyID(ctx, second); !errors.Is(err, apperr.ErrNotFound) {
		t.Fatalf("revoked token resolves: %v", err)
	}

	third, err := repos.Portal.Issue(ctx, key.ID)
	if err != nil {
		t.Fatal(err)
	}
	if err := repos.APIKeys.Delete(ctx, key.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := repos.Portal.KeyID(ctx, third); !errors.Is(err, apperr.ErrNotFound) {
		t.Fatalf("token outlived its key: %v", err)
	}
}
