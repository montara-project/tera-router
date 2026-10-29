package handlers

import (
	"encoding/json"
	"net/http/httptest"
	"testing"
	"time"

	"tera-router/server/internal/middlewares"

	"github.com/gofiber/fiber/v3"
)

// TestPlanKeyUsage pins that a capped plan reports each assigned key's own
// period spend, and an uncapped plan reports none.
func TestPlanKeyUsage(t *testing.T) {
	a, _ := newSeedHarness(t)
	now := time.Now().UTC()
	for _, q := range []struct {
		sql  string
		args []any
	}{
		{`INSERT INTO plans (id, name, description, limit_micros, limit_tokens, period, alert_pct, hard_cutoff) VALUES
			('p-cap', 'Capped', '', 4000000, 0, 'monthly', 80, true),
			('p-free', 'Free', '', 0, 0, 'monthly', 80, false)`, nil},
		{`INSERT INTO api_keys (id, plan_id, name, key_hash, lookup_hash) VALUES
			('k1', 'p-cap', 'one', 'h1', 'l1'), ('k2', 'p-cap', 'two', 'h2', 'l2'), ('k3', 'p-free', 'three', 'h3', 'l3')`, nil},
		{`INSERT INTO usage_records (api_key_id, provider, model, prompt_tokens, completion_tokens, cost_micros, created_at) VALUES
			('k1', 'openai', 'gpt-4o', 10, 5, 3000000, ?), ('k3', 'openai', 'gpt-4o', 10, 5, 9000000, ?)`, []any{now, now}},
	} {
		if _, err := a.Repos.DB.Exec(q.sql, q.args...); err != nil {
			t.Fatal(err)
		}
	}

	h := &plansHandler{app: a}
	f := fiber.New(fiber.Config{ErrorHandler: middlewares.ErrorHandler})
	f.Get("/plans", h.Index)
	resp, err := f.Test(httptest.NewRequest("GET", "/plans", nil))
	if err != nil {
		t.Fatal(err)
	}
	var out struct {
		Data []struct {
			ID       string `json:"id"`
			KeyUsage []struct {
				ID          string  `json:"id"`
				SpentMicros int64   `json:"spent_micros"`
				SpendPct    float64 `json:"spend_pct"`
			} `json:"key_usage"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		t.Fatal(err)
	}
	got := map[string]map[string][2]float64{}
	for _, p := range out.Data {
		got[p.ID] = map[string][2]float64{}
		for _, u := range p.KeyUsage {
			got[p.ID][u.ID] = [2]float64{float64(u.SpentMicros), u.SpendPct}
		}
	}
	if g := got["p-cap"]; len(g) != 2 || g["k1"] != [2]float64{3000000, 75} || g["k2"] != [2]float64{0, 0} {
		t.Errorf("capped plan usage = %v, want k1 3M/75%%, k2 0/0%%", g)
	}
	if g := got["p-free"]; len(g) != 0 {
		t.Errorf("uncapped plan usage = %v, want none", g)
	}
}
