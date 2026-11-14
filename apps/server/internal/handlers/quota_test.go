package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"slices"
	"testing"

	"tera-router/server/internal/dtos"
	"tera-router/server/internal/models"
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

// TestQuotaIndexFilters pins that the quota list is narrowed, ordered and
// paged by the server, and that its total counts the matching rows.
func TestQuotaIndexFilters(t *testing.T) {
	h := newBackupHarness(t, "test-secret")
	accounts := []models.Account{
		{ID: "a1", Provider: "cline", Label: "Zeta", KeyHash: "h1"},
		{ID: "a2", Provider: "cline", Label: "alpha", KeyHash: "h2", Disabled: true},
		{ID: "a3", Provider: "zcode", Label: "Beta", KeyHash: "h3"},
	}
	for i := range accounts {
		accounts[i].AuthKind = models.AuthAPIKey
		accounts[i].Metadata = "{}"
	}
	if err := h.app.Repos.Accounts.BulkInsert(context.Background(), accounts); err != nil {
		t.Fatal(err)
	}
	handler := &quotaHandler{app: h.app}
	h.fiber.Get("/quota", handler.Index)
	h.fiber.Get("/quota/overview", handler.Overview)

	runListCases(t, h, "/quota", "id", []listCase{
		{query: "?limit=100", want: []string{"a1", "a2", "a3"}, total: 3},
		{query: "?provider=cline", want: []string{"a1", "a2"}, total: 2},
		{query: "?status=paused", want: []string{"a2"}, total: 1},
		{query: "?status=active&provider=cline", want: []string{"a1"}, total: 1},
		{query: "?search=ZCODE", want: []string{"a3"}, total: 1},
		{query: "?search=alp", want: []string{"a2"}, total: 1},
		{query: "?quota_state=quota-capable", want: nil, total: 0},
		{query: "?sort=name&limit=2", want: []string{"a2", "a3"}, total: 3, ordered: true},
		{query: "?sort=name&limit=2&offset=2", want: []string{"a1"}, total: 3, ordered: true},
	})

	// The overview carries what the page needs besides the rows: the chip
	// counts and the providers to filter by.
	_, raw := h.do(t, httptest.NewRequest(http.MethodGet, "/quota/overview", nil))
	var res struct {
		Data struct {
			Summary dtos.QuotaSummary `json:"summary"`
		} `json:"data"`
	}
	if err := json.Unmarshal(raw, &res); err != nil {
		t.Fatal(err)
	}
	s := res.Data.Summary
	if s.TotalAccounts != 3 || s.ActiveAccounts != 2 || s.Paused != 1 {
		t.Errorf("summary counts = %d total, %d active, %d paused; want 3, 2, 1", s.TotalAccounts, s.ActiveAccounts, s.Paused)
	}
	if !slices.Equal(s.Providers, []string{"cline", "zcode"}) {
		t.Errorf("summary providers = %v, want [cline zcode]", s.Providers)
	}
}
