package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

// TestUsageTables pins that the Usage page's tables are searched, sorted and
// paged by the server: the request log across the whole window (not a recent
// slice), and the model and provider accounting.
func TestUsageTables(t *testing.T) {
	h := newBackupHarness(t, "test-secret")
	now := time.Now().UTC()
	for _, q := range []struct {
		sql  string
		args []any
	}{
		{`INSERT INTO api_keys (id, name, key_hash, lookup_hash) VALUES ('k1', 'team-key', 'h1', 'l1')`, nil},
		{`INSERT INTO usage_records (request_id, api_key_id, provider, model, client, prompt_tokens, completion_tokens, cost_micros, failed, created_at) VALUES
			('r1', 'k1', 'openai', 'gpt-4o', 'cursor', 10, 5, 100, false, ?),
			('r2', '', 'openai', 'gpt-4o-mini', '', 0, 0, 0, true, ?),
			('r3', '', 'cline', 'sonnet', 'cline-cli', 20, 5, 100, false, ?)`,
			[]any{now.Add(-3 * time.Minute), now.Add(-2 * time.Minute), now.Add(-time.Minute)}},
	} {
		if _, err := h.app.Repos.DB.Exec(q.sql, q.args...); err != nil {
			t.Fatal(err)
		}
	}
	handler := &usageHandler{app: h.app}
	h.fiber.Get("/usage/requests", handler.Requests)
	h.fiber.Get("/usage/models", handler.Models)
	h.fiber.Get("/usage/providers", handler.Providers)

	runListCases(t, h, "/usage/requests", "model", []listCase{
		{query: "", want: []string{"sonnet", "gpt-4o-mini", "gpt-4o"}, total: 3, ordered: true},
		{query: "?status=failed", want: []string{"gpt-4o-mini"}, total: 1},
		{query: "?search=TEAM", want: []string{"gpt-4o"}, total: 1},
		{query: "?search=cursor", want: []string{"gpt-4o"}, total: 1},
		{query: "?search=cline", want: []string{"sonnet"}, total: 1},
		{query: "?search=gpt&status=failed", want: []string{"gpt-4o-mini"}, total: 1},
		{query: "?limit=2&offset=2", want: []string{"gpt-4o"}, total: 3, ordered: true},
		{query: "?search=nothing", want: nil, total: 0},
	})

	// The status chips count the whole window, whatever is searched.
	_, raw := h.do(t, httptest.NewRequest(http.MethodGet, "/usage/requests?search=cursor", nil))
	var res struct {
		Metadata map[string]int `json:"metadata"`
	}
	if err := json.Unmarshal(raw, &res); err != nil {
		t.Fatal(err)
	}
	if res.Metadata["total_all"] != 3 || res.Metadata["total_failed"] != 1 {
		t.Errorf("metadata = %v, want total_all 3, total_failed 1", res.Metadata)
	}

	runListCases(t, h, "/usage/models", "model", []listCase{
		{query: "", want: []string{"gpt-4o", "gpt-4o-mini", "sonnet"}, total: 3},
		{query: "?provider=openai", want: []string{"gpt-4o", "gpt-4o-mini"}, total: 2},
		{query: "?search=MINI", want: []string{"gpt-4o-mini"}, total: 1},
		// Without a provider the search also matches the provider slug.
		{query: "?search=cline", want: []string{"sonnet"}, total: 1},
		// Within a provider it matches the model name only.
		{query: "?provider=openai&search=openai", want: nil, total: 0},
		{query: "?sort=model&order=asc", want: []string{"gpt-4o", "gpt-4o-mini", "sonnet"}, total: 3, ordered: true},
		{query: "?sort=model", want: []string{"sonnet", "gpt-4o-mini", "gpt-4o"}, total: 3, ordered: true},
		{query: "?sort=model&order=asc&limit=1&offset=1", want: []string{"gpt-4o-mini"}, total: 3, ordered: true},
	})

	if rows, total := getList(t, h, "/usage/providers?limit=1", "requests"); len(rows) != 1 || total != 2 {
		t.Errorf("providers page = %d rows, total %d; want 1 of 2", len(rows), total)
	}
}
