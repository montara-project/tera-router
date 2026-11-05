package handlers

import (
	"context"
	"testing"
)

// TestQuotaAuthLabel pins the account sub-label: the provider's display name
// (not its slug) and a readable auth kind; an unknown slug stays as is.
func TestQuotaAuthLabel(t *testing.T) {
	a, _ := newSeedHarness(t)
	if _, err := a.Repos.DB.Exec(`INSERT INTO accounts (id, provider, label, auth_kind) VALUES
		('acc-1', 'openai', 'Dev', 'api_key'),
		('acc-2', 'gone-provider', 'Old', 'oauth')`); err != nil {
		t.Fatal(err)
	}

	rows, err := (&quotaHandler{app: a}).quotaRows(context.Background(), "30d")
	if err != nil {
		t.Fatal(err)
	}
	want := map[string]string{
		"acc-1": "OpenAI · API key",
		"acc-2": "gone-provider · OAuth",
	}
	for _, r := range rows {
		if w, ok := want[r.ID]; ok && r.AuthLabel != w {
			t.Errorf("%s auth_label = %q, want %q", r.ID, r.AuthLabel, w)
		}
	}
}
