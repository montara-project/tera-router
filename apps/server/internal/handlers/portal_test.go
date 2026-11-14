package handlers

import (
	"context"
	"encoding/json"
	"net/http/httptest"
	"testing"
	"time"

	"tera-router/server/internal/middlewares"
	"tera-router/server/internal/models"

	"github.com/gofiber/fiber/v3"
)

// TestPortalShowsOnlyItsKey pins the usage portal contract: the token reads
// its own key's usage (with the key's budget as a limit), never another
// key's, and unknown tokens and ranges are refused.
func TestPortalShowsOnlyItsKey(t *testing.T) {
	a, _ := newSeedHarness(t)
	ctx := context.Background()
	for _, k := range []models.APIKey{
		{ID: "key-1", Name: "Mine", KeyHash: "h1", LookupHash: "l1", Display: "kr_mine…0001"},
		{ID: "key-2", Name: "Other", KeyHash: "h2", LookupHash: "l2", Display: "kr_othr…0002"},
	} {
		if err := a.Repos.APIKeys.Insert(ctx, k); err != nil {
			t.Fatal(err)
		}
	}
	now := time.Now().UTC()
	if _, err := a.Repos.DB.Exec(`INSERT INTO usage_records
		(api_key_id, request_id, provider, model, client_ip, prompt_tokens, completion_tokens, cost_micros, created_at) VALUES
		('key-1', 'r1', 'openai', 'gpt-4o', '10.0.0.1', 100, 50, 1000, ?),
		('key-1', 'r2', 'openai', 'gpt-4o', '10.0.0.1', 10, 5, 100, ?),
		('key-2', 'r3', 'openai', 'gpt-4o', '10.0.0.2', 999, 999, 9999, ?)`, now, now, now); err != nil {
		t.Fatal(err)
	}
	if _, err := a.Repos.DB.Exec(`INSERT INTO budgets (id, scope_kind, scope_id, limit_tokens, period) VALUES
		('b-key', 'api_key', 'key-1', 1000, 'monthly'), ('b-other', 'api_key', 'key-2', 5, 'daily')`); err != nil {
		t.Fatal(err)
	}
	token, err := a.Repos.Portal.Issue(ctx, "key-1")
	if err != nil {
		t.Fatal(err)
	}

	h := &portalHandler{app: a}
	f := fiber.New(fiber.Config{ErrorHandler: middlewares.ErrorHandler})
	f.Get("/portal/:token", h.Show)

	for path, want := range map[string]int{
		"/portal/pt_unknown":           404,
		"/portal/" + token + "?days=5": 400,
	} {
		resp, err := f.Test(httptest.NewRequest("GET", path, nil))
		if err != nil {
			t.Fatal(err)
		}
		if resp.StatusCode != want {
			t.Errorf("%s status = %d, want %d", path, resp.StatusCode, want)
		}
	}

	resp, err := f.Test(httptest.NewRequest("GET", "/portal/"+token+"?days=7", nil))
	if err != nil {
		t.Fatal(err)
	}
	var out struct {
		Data struct {
			Key     struct{ Name string } `json:"key"`
			Summary struct {
				Requests     int64 `json:"requests"`
				PromptTokens int64 `json:"prompt_tokens"`
				CostMicros   int64 `json:"cost_micros"`
			} `json:"summary"`
			Models []struct{ Requests int64 } `json:"models"`
			Recent []map[string]any           `json:"recent"`
			Limits []portalLimit              `json:"limits"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		t.Fatal(err)
	}
	d := out.Data
	if d.Key.Name != "Mine" || d.Summary.Requests != 2 || d.Summary.PromptTokens != 110 || d.Summary.CostMicros != 1100 {
		t.Fatalf("portal = %+v, want key-1's 2 requests, 110 in, 1100 micros", d)
	}
	if len(d.Models) != 1 || d.Models[0].Requests != 2 || len(d.Recent) != 2 {
		t.Fatalf("models = %+v, recent = %d rows", d.Models, len(d.Recent))
	}

	// The request log pages on the server and still reports the window's size.
	pageResp, err := f.Test(httptest.NewRequest("GET", "/portal/"+token+"?days=7&limit=1&offset=1", nil))
	if err != nil {
		t.Fatal(err)
	}
	var page struct {
		Data struct {
			Recent      []map[string]any `json:"recent"`
			RecentTotal int              `json:"recent_total"`
		} `json:"data"`
	}
	if err := json.NewDecoder(pageResp.Body).Decode(&page); err != nil {
		t.Fatal(err)
	}
	if len(page.Data.Recent) != 1 || page.Data.RecentTotal != 2 {
		t.Fatalf("page = %d recent rows, recent_total %d; want 1 of 2", len(page.Data.Recent), page.Data.RecentTotal)
	}
	if _, leaked := d.Recent[0]["client_ip"]; leaked {
		t.Fatal("recent requests expose the client IP")
	}
	if d.Recent[0]["api_kind"] != "openai" {
		t.Errorf("recent api_kind = %v, want openai so the avatar matches /providers", d.Recent[0]["api_kind"])
	}
	for _, field := range []string{"id", "cached_tokens", "cache_write_tokens", "reasoning_tokens", "token_consumption_rate"} {
		if _, ok := d.Recent[0][field]; !ok {
			t.Errorf("recent request is missing %q for the detail dialog", field)
		}
	}
	if len(d.Limits) != 1 || d.Limits[0].Used != 165 || d.Limits[0].Limit != 1000 || d.Limits[0].Label != "Monthly tokens" {
		t.Fatalf("limits = %+v, want key-1's monthly token budget at 165 of 1000", d.Limits)
	}
}
