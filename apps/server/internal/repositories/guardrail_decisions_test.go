package repositories_test

import (
	"context"
	"testing"
	"time"

	"tera-router/server/internal/models"
)

// TestDecisionsForKey pins that a key's guardrail stats count each decision
// kind from the gateway's audit rows, fold every PII strategy into masked, and
// skip other keys, policy edits and rows before the window.
func TestDecisionsForKey(t *testing.T) {
	repos := newProviderRepos(t)
	ctx := context.Background()

	add := func(action, keyID string) {
		t.Helper()
		err := repos.Audit.Insert(ctx, models.AuditEntry{
			ID:     action + "-" + keyID + "-" + time.Now().Format(time.RFC3339Nano),
			Action: action,
			Detail: `{"key_id":"` + keyID + `"}`,
		})
		if err != nil {
			t.Fatalf("insert audit: %v", err)
		}
	}
	for _, a := range []string{"guardrail.block", "guardrail.block", "guardrail.redact", "guardrail.hash", "guardrail.warn", "guardrail.log"} {
		add(a, "key-a")
	}
	add("guardrail.block", "key-b")
	add("guardrail.policy.update", "key-a")

	got, err := repos.Guardrails.DecisionsForKey(ctx, "key-a", time.Now().AddDate(0, 0, -7))
	if err != nil {
		t.Fatal(err)
	}
	want := struct{ b, m, w, l int64 }{2, 2, 1, 1}
	if got.Blocked != want.b || got.Masked != want.m || got.Warned != want.w || got.Logged != want.l {
		t.Fatalf("decisions = %+v, want %+v", got, want)
	}

	future, err := repos.Guardrails.DecisionsForKey(ctx, "key-a", time.Now().Add(time.Hour))
	if err != nil {
		t.Fatal(err)
	}
	if future.Blocked != 0 {
		t.Fatalf("rows before the window counted: %+v", future)
	}
}
