package handlers

import (
	"encoding/json"
	"net/http/httptest"
	"strings"
	"testing"

	"tera-router/server/internal/middlewares"

	"github.com/gofiber/fiber/v3"
)

// TestProviderRoutingRoundTrip pins the account strategy endpoints: the
// default before anything is stored, a valid update read back, and rejection
// of unknown providers, strategies and out-of-range knobs.
func TestProviderRoutingRoundTrip(t *testing.T) {
	a, _ := newSeedHarness(t)
	if _, err := a.Repos.DB.Exec(`INSERT INTO custom_providers (id, name, slug) VALUES ('11111111-1111-1111-1111-111111111111', 'Mine', 'mine-llm')`); err != nil {
		t.Fatal(err)
	}
	h := &providersHandler{app: a}
	f := fiber.New(fiber.Config{ErrorHandler: middlewares.ErrorHandler})
	f.Get("/providers/:id/routing", h.Routing)
	f.Put("/providers/:id/routing", h.RoutingUpdate)

	call := func(method, slug, body string) (int, map[string]any) {
		t.Helper()
		req := httptest.NewRequest(method, "/providers/"+slug+"/routing", strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		resp, err := f.Test(req)
		if err != nil {
			t.Fatal(err)
		}
		var out map[string]any
		_ = json.NewDecoder(resp.Body).Decode(&out)
		data, _ := out["data"].(map[string]any)
		return resp.StatusCode, data
	}

	if status, data := call("GET", "openai", ""); status != 200 || data["strategy"] != "default" || data["sticky_limit"] != float64(3) || data["affinity_hours"] != float64(24) {
		t.Fatalf("default = %d %v", status, data)
	}

	body := `{"strategy":"smart-round-robin","sticky_limit":2,"affinity_hours":6}`
	for _, slug := range []string{"openai", "mine-llm"} {
		if status, _ := call("PUT", slug, body); status != 200 {
			t.Fatalf("PUT %s = %d", slug, status)
		}
		if status, data := call("GET", slug, ""); status != 200 || data["strategy"] != "smart-round-robin" || data["affinity_hours"] != float64(6) {
			t.Fatalf("GET %s after PUT = %d %v", slug, status, data)
		}
	}

	if status, _ := call("GET", "no-such-provider", ""); status != 404 {
		t.Fatalf("unknown provider = %d, want 404", status)
	}
	for _, bad := range []string{
		`{"strategy":"random","sticky_limit":1,"affinity_hours":1}`,
		`{"strategy":"round-robin","sticky_limit":0,"affinity_hours":1}`,
		`{"strategy":"round-robin","sticky_limit":1,"affinity_hours":0}`,
		`{"strategy":"round-robin","sticky_limit":1,"affinity_hours":721}`,
	} {
		if status, _ := call("PUT", "openai", bad); status != 422 && status != 400 {
			t.Fatalf("PUT %s = %d, want a validation error", bad, status)
		}
	}
}
