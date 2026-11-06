package repositories_test

import (
	"context"
	"testing"
	"time"

	"tera-router/server/internal/models"
)

// TestSummaryForKey pins that a key's usage counts client requests (fallback
// re-attempts share a request_id), sums tokens and cost, and skips other keys
// and rows before the window.
func TestSummaryForKey(t *testing.T) {
	repos := newProviderRepos(t)
	ctx := context.Background()
	key, other := "key-a", "key-b"
	now := time.Now()

	rows := []models.UsageRecord{
		{APIKeyID: &key, RequestID: "r1", PromptTokens: 10, CompletionTokens: 5, CostMicros: 100, CreatedAt: now},
		{APIKeyID: &key, RequestID: "r1", PromptTokens: 3, CompletionTokens: 0, CostMicros: 0, CreatedAt: now},
		{APIKeyID: &key, RequestID: "", PromptTokens: 1, CompletionTokens: 1, CostMicros: 7, CreatedAt: now},
		{APIKeyID: &key, RequestID: "old", PromptTokens: 99, CostMicros: 999, CreatedAt: now.AddDate(0, 0, -40)},
		{APIKeyID: &other, RequestID: "r9", PromptTokens: 50, CostMicros: 500, CreatedAt: now},
	}
	for _, r := range rows {
		r.Provider, r.Model = "p", "m"
		if err := repos.Usage.Insert(ctx, r); err != nil {
			t.Fatalf("insert usage: %v", err)
		}
	}

	got, err := repos.Usage.SummaryForKey(ctx, key, now.AddDate(0, 0, -30))
	if err != nil {
		t.Fatal(err)
	}
	if got.Requests != 2 || got.PromptTokens != 14 || got.CompletionTokens != 6 || got.CostMicros != 107 {
		t.Fatalf("summary = %+v, want 2 requests, 14 in, 6 out, 107 micros", got)
	}
}
