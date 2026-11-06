package repositories_test

import (
	"context"
	"testing"

	"tera-router/server/internal/models"
	"tera-router/server/internal/repositories"
)

// TestAuditChain pins that appends form a verifiable hash chain, that editing
// or deleting a row breaks it at that row, and that rows from before the
// chain are counted as legacy instead of failing verification.
func TestAuditChain(t *testing.T) {
	repos := newProviderRepos(t)
	ctx := context.Background()

	if _, err := repos.Audit.DB.ExecContext(ctx,
		`INSERT INTO audit_entries (id, actor, action, target) VALUES ('legacy', 'u', 'keys.create', 'k0')`); err != nil {
		t.Fatal(err)
	}
	for i, action := range []string{"keys.create", "auth.sign_in", "keys.delete", "chain.update"} {
		e := models.AuditEntry{ID: "e" + string(rune('1'+i)), Actor: "u", Action: action, Target: "t", Detail: "{}"}
		if action == "auth.sign_in" {
			e.Outcome = models.AuditOutcomeFailed
			e.ClientIP = "203.0.113.9"
		}
		if err := repos.Audit.Insert(ctx, e); err != nil {
			t.Fatalf("insert %s: %v", action, err)
		}
	}

	v, err := repos.Audit.Verify(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if !v.OK || v.Checked != 4 || v.Legacy != 1 {
		t.Fatalf("verify = %+v, want ok with 4 checked and 1 legacy", v)
	}

	rows, total, err := repos.Audit.List(ctx, repositories.AuditFilter{Category: "keys", Limit: 10})
	if err != nil || total != 3 || len(rows) != 3 {
		t.Fatalf("category keys = %d rows (total %d), err %v; want 3", len(rows), total, err)
	}
	rows, total, _ = repos.Audit.List(ctx, repositories.AuditFilter{Search: "203.0.113", Outcome: "failed", Limit: 10})
	if total != 1 || rows[0].Action != "auth.sign_in" || rows[0].Seq == nil || *rows[0].Seq != 2 {
		t.Fatalf("search by IP = %+v (total %d), want the failed sign-in at seq 2", rows, total)
	}
	counts, err := repos.Audit.Counts(ctx)
	if err != nil || counts.Recorded != 5 || counts.Failed != 1 || len(counts.Categories) != 3 {
		t.Fatalf("counts = %+v, err %v", counts, err)
	}

	// Editing a row's content breaks the chain at that row.
	if _, err := repos.Audit.DB.ExecContext(ctx, `UPDATE audit_entries SET target = 'other' WHERE seq = 3`); err != nil {
		t.Fatal(err)
	}
	v, _ = repos.Audit.Verify(ctx)
	if v.OK || v.BrokenSeq == nil || *v.BrokenSeq != 3 || v.Reason != "row content does not match its hash" {
		t.Fatalf("after edit verify = %+v, want broken at 3 by content", v)
	}

	// Deleting a row leaves a gap the walk reports.
	if _, err := repos.Audit.DB.ExecContext(ctx, `DELETE FROM audit_entries WHERE seq = 2`); err != nil {
		t.Fatal(err)
	}
	v, _ = repos.Audit.Verify(ctx)
	if v.OK || v.BrokenSeq == nil || *v.BrokenSeq != 3 || v.Reason != "row #2 is missing" {
		t.Fatalf("after delete verify = %+v, want row #2 missing", v)
	}
}
