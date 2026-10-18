package handlers

import (
	"encoding/json"
	"net/http/httptest"
	"strings"
	"testing"

	"tera-router/server/internal/middlewares"

	"github.com/gofiber/fiber/v3"
)

// TestCustomBulkDeleteOnlyRemovesEmptyProviders pins that bulk delete never
// takes credentials with it: a provider with any account (a disabled one
// included) is skipped, while an empty one goes with its scoped rows.
func TestCustomBulkDeleteOnlyRemovesEmptyProviders(t *testing.T) {
	a, _ := newSeedHarness(t)
	db := a.Repos.DB
	h := &providersHandler{app: a}
	f := fiber.New(fiber.Config{ErrorHandler: middlewares.ErrorHandler})
	f.Post("/bulk-delete", h.CustomBulkDelete)

	const (
		empty   = "11111111-1111-1111-1111-111111111111"
		withKey = "22222222-2222-2222-2222-222222222222"
		missing = "33333333-3333-3333-3333-333333333333"
	)
	for _, q := range []string{
		`INSERT INTO custom_providers (id, name, slug) VALUES ('` + empty + `', 'Empty', 'empty-llm')`,
		`INSERT INTO custom_providers (id, name, slug) VALUES ('` + withKey + `', 'Keyed', 'keyed-llm')`,
		`INSERT INTO accounts (id, provider, disabled) VALUES ('acc-1', 'keyed-llm', true)`,
		`INSERT INTO model_pricing_overrides (id, provider, model) VALUES ('po-1', 'empty-llm', 'm')`,
		`INSERT INTO settings (key, value) VALUES ('provider_models_empty-llm', '{}')`,
	} {
		if _, err := db.Exec(q); err != nil {
			t.Fatalf("%s: %v", q, err)
		}
	}

	call := func(body string) (int, map[string]any) {
		t.Helper()
		req := httptest.NewRequest("POST", "/bulk-delete", strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		resp, err := f.Test(req)
		if err != nil {
			t.Fatal(err)
		}
		var out map[string]any
		_ = json.NewDecoder(resp.Body).Decode(&out)
		return resp.StatusCode, out
	}
	count := func(q string) int {
		var n int
		if err := db.QueryRow(q).Scan(&n); err != nil {
			t.Fatalf("%s: %v", q, err)
		}
		return n
	}

	if status, _ := call(`{"ids":["not-a-uuid"]}`); status != fiber.StatusBadRequest {
		t.Fatalf("invalid id = %d, want 400", status)
	}
	if status, _ := call(`{"ids":[]}`); status != fiber.StatusBadRequest {
		t.Fatalf("empty list = %d, want 400", status)
	}

	status, out := call(`{"ids":["` + empty + `","` + withKey + `","` + missing + `","` + empty + `"]}`)
	if status != fiber.StatusOK {
		t.Fatalf("bulk delete = %d %v", status, out)
	}
	data, _ := out["data"].(map[string]any)
	deleted, _ := data["deleted"].([]any)
	if len(deleted) != 1 || deleted[0] != empty || data["skipped"] != float64(2) {
		t.Fatalf("result = %v, want only the empty provider deleted and 2 skipped", data)
	}

	if n := count(`SELECT count(*) FROM custom_providers WHERE id = '` + empty + `'`); n != 0 {
		t.Error("empty provider still exists")
	}
	if n := count(`SELECT count(*) FROM model_pricing_overrides WHERE provider = 'empty-llm'`) +
		count(`SELECT count(*) FROM settings WHERE key = 'provider_models_empty-llm'`); n != 0 {
		t.Error("empty provider's overrides or model catalog were left behind")
	}
	if n := count(`SELECT count(*) FROM custom_providers WHERE id = '` + withKey + `'`); n != 1 {
		t.Error("provider with a (disabled) account was deleted")
	}
	if n := count(`SELECT count(*) FROM accounts WHERE id = 'acc-1'`); n != 1 {
		t.Error("bulk delete removed an account")
	}
}
