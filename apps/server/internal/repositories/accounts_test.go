package repositories_test

import (
	"context"
	"testing"

	"tera-router/server/internal/models"
)

// TestCountUsableByProvider counts only enabled accounts that need no
// re-authentication, and omits providers left with none.
func TestCountUsableByProvider(t *testing.T) {
	repos := newProviderRepos(t)
	ctx := context.Background()

	for _, a := range []models.Account{
		{ID: "a1", Provider: "openai"},
		{ID: "a2", Provider: "openai", Disabled: true},
		{ID: "a3", Provider: "anthropic", Disabled: true},
		{ID: "a4", Provider: "gemini", NeedsReconnect: true},
	} {
		a.Label, a.AuthKind, a.Metadata = "key", models.AuthAPIKey, "{}"
		a.Secret = models.Sealed{WrappedDEK: "dek", Ciphertext: "ct"}
		if err := repos.Accounts.Insert(ctx, a); err != nil {
			t.Fatalf("insert account %s: %v", a.ID, err)
		}
	}

	counts, err := repos.Accounts.CountUsableByProvider(ctx)
	if err != nil {
		t.Fatalf("count usable: %v", err)
	}
	if len(counts) != 1 || counts["openai"] != 1 {
		t.Fatalf("counts = %v, want map[openai:1]", counts)
	}
}
