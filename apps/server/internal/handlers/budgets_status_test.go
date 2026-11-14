package handlers

import (
	"encoding/json"
	"net/http/httptest"
	"slices"
	"testing"
	"time"

	"tera-router/server/internal/middlewares"

	"github.com/gofiber/fiber/v3"
)

// TestBudgetStatusPerScope pins that each budget reports its own scope's
// spend: the whole instance counts every request, an API key only its own,
// a provider account only what it served.
func TestBudgetStatusPerScope(t *testing.T) {
	a, _ := newSeedHarness(t)
	now := time.Now().UTC()
	for _, q := range []struct {
		sql  string
		args []any
	}{
		{`INSERT INTO budgets (id, scope_kind, scope_id, limit_micros, period) VALUES
			('b-tenant', 'tenant', '', 10000000, 'monthly'),
			('b-key', 'api_key', 'key-1', 10000000, 'monthly'),
			('b-acc', 'account', 'acc-1', 10000000, 'monthly')`, nil},
		{`INSERT INTO usage_records (api_key_id, account_id, provider, model, prompt_tokens, completion_tokens, cost_micros, created_at) VALUES
			('key-1', 'acc-2', 'openai', 'gpt-4o', 100, 50, 1000000, ?),
			('key-2', 'acc-1', 'openai', 'gpt-4o', 200, 100, 2000000, ?),
			('key-2', 'acc-2', 'openai', 'gpt-4o', 400, 200, 4000000, ?)`, []any{now, now, now}},
	} {
		if _, err := a.Repos.DB.Exec(q.sql, q.args...); err != nil {
			t.Fatal(err)
		}
	}

	h := &budgetsHandler{app: a}
	f := fiber.New(fiber.Config{ErrorHandler: middlewares.ErrorHandler})
	f.Get("/budgets/status", h.Status)
	resp, err := f.Test(httptest.NewRequest("GET", "/budgets/status", nil))
	if err != nil {
		t.Fatal(err)
	}
	var out struct {
		Data []struct {
			ID          string    `json:"id"`
			SpentMicros int64     `json:"spent_micros"`
			SpentTokens int64     `json:"spent_tokens"`
			ResetsAt    time.Time `json:"resets_at"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		t.Fatal(err)
	}

	want := map[string][2]int64{
		"b-tenant": {7000000, 1050},
		"b-key":    {1000000, 150},
		"b-acc":    {2000000, 300},
	}
	if len(out.Data) != len(want) {
		t.Fatalf("got %d budgets, want %d", len(out.Data), len(want))
	}
	for _, b := range out.Data {
		if got := [2]int64{b.SpentMicros, b.SpentTokens}; got != want[b.ID] {
			t.Errorf("%s spent = %v, want %v", b.ID, got, want[b.ID])
		}
		if !b.ResetsAt.After(time.Now()) || b.ResetsAt.Sub(time.Now()) > 32*24*time.Hour {
			t.Errorf("%s resets_at = %v, want within the next month", b.ID, b.ResetsAt)
		}
	}
}

// TestBudgetStatusOrderSummaryAndPage pins what the budgets page reads from
// the server instead of working out itself: the order (closest to its limit
// first), the summary counts over every budget, the scope's name, and a page
// cut from the ordered rows.
func TestBudgetStatusOrderSummaryAndPage(t *testing.T) {
	a, _ := newSeedHarness(t)
	now := time.Now().UTC()
	for _, q := range []struct {
		sql  string
		args []any
	}{
		{`INSERT INTO accounts (id, provider, label, auth_kind) VALUES ('acc-1', 'openai', 'Dev', 'api_key')`, nil},
		{`INSERT INTO budgets (id, scope_kind, scope_id, limit_micros, period, alert_pct, hard_cutoff) VALUES
			('b-tenant', 'tenant', '', 10000000, 'monthly', 90, 0),
			('b-key', 'api_key', 'key-1', 1000000, 'monthly', 90, 1),
			('b-acc', 'account', 'acc-1', 4000000, 'monthly', 40, 0)`, nil},
		{`INSERT INTO usage_records (api_key_id, account_id, provider, model, prompt_tokens, completion_tokens, cost_micros, created_at) VALUES
			('key-1', 'acc-2', 'openai', 'gpt-4o', 100, 50, 1000000, ?),
			('key-2', 'acc-1', 'openai', 'gpt-4o', 200, 100, 2000000, ?),
			('key-2', 'acc-2', 'openai', 'gpt-4o', 400, 200, 4000000, ?)`, []any{now, now, now}},
	} {
		if _, err := a.Repos.DB.Exec(q.sql, q.args...); err != nil {
			t.Fatal(err)
		}
	}

	f := fiber.New(fiber.Config{ErrorHandler: middlewares.ErrorHandler})
	f.Get("/budgets/status", (&budgetsHandler{app: a}).Status)
	get := func(query string) (ids []string, names map[string]string, meta map[string]int) {
		t.Helper()
		resp, err := f.Test(httptest.NewRequest("GET", "/budgets/status"+query, nil))
		if err != nil {
			t.Fatal(err)
		}
		var out struct {
			Data []struct {
				ID        string `json:"id"`
				ScopeName string `json:"scope_name"`
			} `json:"data"`
			Metadata map[string]int `json:"metadata"`
		}
		if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
			t.Fatal(err)
		}
		names = map[string]string{}
		for _, b := range out.Data {
			ids = append(ids, b.ID)
			names[b.ID] = b.ScopeName
		}
		return ids, names, out.Metadata
	}

	// 100% (exhausted, blocking), 70%, 50% (past its 40% alert).
	ids, names, meta := get("")
	if want := []string{"b-key", "b-tenant", "b-acc"}; !slices.Equal(ids, want) {
		t.Errorf("order = %v, want %v", ids, want)
	}
	if names["b-acc"] != "openai · Dev" || names["b-tenant"] != "" {
		t.Errorf("scope names = %v, want the account's provider and label, and none for the instance", names)
	}
	if meta["total"] != 3 || meta["exhausted"] != 1 || meta["blocking"] != 1 || meta["past_alert"] != 1 {
		t.Errorf("metadata = %v, want total 3, exhausted 1, blocking 1, past_alert 1", meta)
	}

	ids, _, meta = get("?limit=2&offset=1")
	if want := []string{"b-tenant", "b-acc"}; !slices.Equal(ids, want) {
		t.Errorf("page = %v, want %v", ids, want)
	}
	if meta["total"] != 3 || meta["exhausted"] != 1 {
		t.Errorf("paged metadata = %v, want the counts over every budget", meta)
	}
}
