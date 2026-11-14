package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"tera-router/server/internal/models"
)

// TestChainsIndexFilters pins the chain list filters the dashboard sends
// instead of filtering in the browser, and that the list stays whole when no
// limit is sent (pickers read it that way).
func TestChainsIndexFilters(t *testing.T) {
	h := newBackupHarness(t, "test-secret")
	ctx := context.Background()
	for _, ch := range []models.Chain{
		{ID: "c1", Name: "alpha", Strategy: "priority", Enabled: true, Steps: []models.ChainStep{{ID: "s1", Provider: "openai", Model: "gpt-4o", Position: 1, Active: true}}},
		{ID: "c2", Name: "beta", Strategy: "round_robin", Enabled: false, Steps: []models.ChainStep{{ID: "s2", Provider: "cline", Model: "sonnet", Position: 1, Active: true}}},
		{ID: "c3", Name: "gamma", Strategy: "priority", Enabled: true, FallbackProvider: "zcode", FallbackModel: "glm-5.3"},
	} {
		if err := h.app.Repos.Chains.Insert(ctx, ch); err != nil {
			t.Fatalf("insert %s: %v", ch.Name, err)
		}
	}
	h.fiber.Get("/chains", (&chainsHandler{app: h.app}).Index)

	runListCases(t, h, "/chains", "id", []listCase{
		{query: "", want: []string{"c1", "c2", "c3"}, total: 3},
		{query: "?strategy=priority", want: []string{"c1", "c3"}, total: 2},
		{query: "?enabled=true", want: []string{"c1", "c3"}, total: 2},
		{query: "?enabled=false", want: []string{"c2"}, total: 1},
		{query: "?provider=cline", want: []string{"c2"}, total: 1},
		{query: "?provider=zcode", want: []string{"c3"}, total: 1},
		{query: "?search=GPT", want: []string{"c1"}, total: 1},
		{query: "?search=glm", want: []string{"c3"}, total: 1},
		{query: "?search=bet", want: []string{"c2"}, total: 1},
		{query: "?health=unknown", want: []string{"c1", "c2", "c3"}, total: 3},
		// A page past the end is empty but still reports the matches.
		{query: "?strategy=priority&limit=1&offset=2", want: nil, total: 2},
	})

	// The filter labels count every chain, whatever filter is applied.
	_, raw := h.do(t, httptest.NewRequest(http.MethodGet, "/chains?strategy=round_robin&health_window=24h", nil))
	var res struct {
		Data     []map[string]any `json:"data"`
		Metadata map[string]int   `json:"metadata"`
	}
	if err := json.Unmarshal(raw, &res); err != nil {
		t.Fatal(err)
	}
	m := res.Metadata
	if len(res.Data) != 1 || m["total"] != 1 || m["total_all"] != 3 || m["count_strategy_priority"] != 2 || m["count_strategy_round_robin"] != 1 {
		t.Errorf("rows = %d, metadata = %v; want 1 row, total 1, total_all 3, 2 priority, 1 round_robin", len(res.Data), m)
	}
}

// TestAliasIndexFilters pins the alias search and status filter.
func TestAliasIndexFilters(t *testing.T) {
	h := newBackupHarness(t, "test-secret")
	for _, sql := range []string{
		`INSERT INTO model_aliases (id, name, group_name, active) VALUES
			('a1', 'fast', 'Coding', 1), ('a2', 'smart', 'coding', 0), ('a3', 'cheap', '', 1)`,
	} {
		if _, err := h.app.Repos.DB.Exec(sql); err != nil {
			t.Fatal(err)
		}
	}
	h.fiber.Get("/aliases", (&chainsHandler{app: h.app}).AliasIndex)

	runListCases(t, h, "/aliases", "id", []listCase{
		{query: "", want: []string{"a1", "a2", "a3"}, total: 3},
		{query: "?status=active", want: []string{"a1", "a3"}, total: 2},
		{query: "?status=inactive", want: []string{"a2"}, total: 1},
		{query: "?search=CODING", want: []string{"a1", "a2"}, total: 2},
		{query: "?search=che", want: []string{"a3"}, total: 1},
		{query: "?search=coding&status=active", want: []string{"a1"}, total: 1},
	})
}
