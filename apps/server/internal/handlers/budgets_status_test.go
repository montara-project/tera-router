package handlers

import (
	"encoding/json"
	"net/http/httptest"
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
			ID          string `json:"id"`
			SpentMicros int64  `json:"spent_micros"`
			SpentTokens int64  `json:"spent_tokens"`
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
	}
}
