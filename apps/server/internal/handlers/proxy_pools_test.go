package handlers

import (
	"encoding/json"
	"net/http/httptest"
	"strings"
	"testing"

	"tera-router/server/internal/middlewares"

	"github.com/gofiber/fiber/v3"
)

// TestProxyPoolBatchEditAndRelay covers the batch import, edit, bulk delete and
// relay-script endpoints the proxy pools page drives.
func TestProxyPoolBatchEditAndRelay(t *testing.T) {
	a, _ := newSeedHarness(t)
	h := &proxyPoolsHandler{app: a}
	f := fiber.New(fiber.Config{ErrorHandler: middlewares.ErrorHandler})
	f.Post("/bulk", h.BulkStore)
	f.Post("/bulk-delete", h.BulkDelete)
	f.Post("/relay-script", h.RelayScript)
	f.Patch("/:id", h.Update)

	call := func(method, path, body string) (int, map[string]any) {
		t.Helper()
		req := httptest.NewRequest(method, path, strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		resp, err := f.Test(req)
		if err != nil {
			t.Fatal(err)
		}
		var out map[string]any
		_ = json.NewDecoder(resp.Body).Decode(&out)
		return resp.StatusCode, out
	}

	// A batch with one bad row lands nothing.
	if status, _ := call("POST", "/bulk", `{"pools":[{"name":"a","url":"http://a:1"},{"name":"","url":"http://b:1"}]}`); status != fiber.StatusUnprocessableEntity {
		t.Fatalf("bad batch = %d, want 422", status)
	}
	status, out := call("POST", "/bulk", `{"pools":[{"name":"a","url":"http://a:1"},{"name":"r","url":"relay+https://:k@r.workers.dev"}]}`)
	if status != fiber.StatusCreated {
		t.Fatalf("batch = %d %v", status, out)
	}
	pools, _ := out["data"].([]any)
	if len(pools) != 2 {
		t.Fatalf("imported %d pools, want 2", len(pools))
	}
	first := pools[0].(map[string]any)
	relay := pools[1].(map[string]any)
	if relay["mode"] != "relay" {
		t.Errorf("relay pool mode = %v, want relay", relay["mode"])
	}

	status, out = call("PATCH", "/"+first["id"].(string), `{"name":"renamed","url":"http://c:2","label":"eu"}`)
	if status != fiber.StatusOK {
		t.Fatalf("update = %d %v", status, out)
	}
	if got := out["data"].(map[string]any); got["name"] != "renamed" || got["url"] != "http://c:2" || got["label"] != "eu" {
		t.Errorf("updated pool = %v", got)
	}

	status, out = call("POST", "/bulk-delete", `{"ids":["`+first["id"].(string)+`","`+relay["id"].(string)+`","33333333-3333-3333-3333-333333333333"]}`)
	if status != fiber.StatusOK {
		t.Fatalf("bulk delete = %d %v", status, out)
	}
	if deleted, _ := out["data"].(map[string]any)["deleted"].([]any); len(deleted) != 2 {
		t.Errorf("deleted = %v, want the 2 existing pools", deleted)
	}

	if status, _ := call("POST", "/relay-script", `{"kind":"nope"}`); status != fiber.StatusUnprocessableEntity {
		t.Fatalf("unknown relay kind = %d, want 422", status)
	}
	for _, kind := range []string{"cloudflare", "local"} {
		status, out = call("POST", "/relay-script", `{"kind":"`+kind+`"}`)
		if status != fiber.StatusOK {
			t.Fatalf("relay script %s = %d %v", kind, status, out)
		}
		data := out["data"].(map[string]any)
		script, poolURL := data["script"].(string), data["pool_url"].(string)
		if strings.Contains(script, "__TERA_RELAY_SECRET__") || !strings.HasPrefix(poolURL, "relay+http") {
			t.Errorf("%s: secret not substituted or bad pool URL %q", kind, poolURL)
		}
		secret := poolURL[strings.Index(poolURL, "://:")+4 : strings.Index(poolURL, "@")]
		if !strings.Contains(script, "'"+secret+"'") {
			t.Errorf("%s: script secret does not match pool URL", kind)
		}
	}
}
