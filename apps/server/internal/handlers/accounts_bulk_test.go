package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"tera-router/server/internal/lib/sealer"
	"tera-router/server/internal/models"
)

// TestAccountBulkStore pins the bulk add contract: one account per key,
// labelled in paste order, with blank lines ignored and duplicates (already
// stored, or repeated in the paste) skipped instead of failing the batch.
func TestAccountBulkStore(t *testing.T) {
	h := newBackupHarness(t, "test-secret")
	existing := models.Account{ID: "acc-existing", Provider: "openai", Label: "old", AuthKind: models.AuthAPIKey, Metadata: "{}"}
	if err := sealCredential(h.app, &existing, accountInput{APIKey: "sk-already-stored-0001"}); err != nil {
		t.Fatal(err)
	}
	if err := h.app.Repos.Accounts.Insert(context.Background(), existing); err != nil {
		t.Fatal(err)
	}
	h.fiber.Post("/accounts/bulk", (&accountsHandler{app: h.app}).BulkStore)

	bulk := func(body string) (int, map[string][]map[string]any) {
		t.Helper()
		req := httptest.NewRequest(http.MethodPost, "/accounts/bulk", strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		status, raw := h.do(t, req)
		var res struct {
			Data map[string][]map[string]any `json:"data"`
		}
		_ = json.Unmarshal(raw, &res)
		return status, res.Data
	}

	status, res := bulk(`{"provider":"openai","label_prefix":"team","priority":50,"api_keys":[
		"sk-new-key-aaaaaaaa0001", "  ", "sk-already-stored-0001", "sk-new-key-bbbbbbbb0002", "sk-new-key-aaaaaaaa0001"]}`)
	if status != http.StatusOK {
		t.Fatalf("bulk add = %d, want 200", status)
	}
	if len(res["created"]) != 2 || len(res["skipped"]) != 2 || len(res["failed"]) != 0 {
		t.Fatalf("created/skipped/failed = %d/%d/%d, want 2/2/0", len(res["created"]), len(res["skipped"]), len(res["failed"]))
	}
	// Labels number the non-blank keys in paste order: 1 and 3 were created.
	if res["created"][0]["label"] != "team 1" || res["created"][1]["label"] != "team 3" {
		t.Errorf("labels = %v, %v, want team 1, team 3", res["created"][0]["label"], res["created"][1]["label"])
	}
	if res["created"][0]["priority"] != float64(50) {
		t.Errorf("priority = %v, want 50", res["created"][0]["priority"])
	}

	accounts, err := h.app.Repos.Accounts.ListByProvider(context.Background(), "openai")
	if err != nil {
		t.Fatal(err)
	}
	if len(accounts) != 3 {
		t.Fatalf("stored %d accounts, want 3", len(accounts))
	}
	stored := map[string]bool{}
	for _, a := range accounts {
		key, err := h.app.Secrets.OpenString(a.Secret, sealer.PurposeAccountSecret)
		if err != nil {
			t.Fatalf("open %s: %v", a.Label, err)
		}
		stored[key] = true
	}
	for _, want := range []string{"sk-already-stored-0001", "sk-new-key-aaaaaaaa0001", "sk-new-key-bbbbbbbb0002"} {
		if !stored[want] {
			t.Errorf("key %s was not stored", want)
		}
	}

	if status, _ := bulk(`{"provider":"openai","api_keys":["", "   "]}`); status != http.StatusBadRequest {
		t.Errorf("only blank keys = %d, want 400", status)
	}
	tooMany := `{"provider":"openai","api_keys":["` + strings.Repeat(`k","`, maxBulkKeys) + `k"]}`
	if status, _ := bulk(tooMany); status != http.StatusBadRequest {
		t.Errorf("%d keys = %d, want 400", maxBulkKeys+1, status)
	}
}

// TestAccountIndexLimit pins that the account list can be read whole: the
// dashboard filters per provider in the browser, so a provider with more than
// 100 accounts needs a page larger than the default ceiling.
func TestAccountIndexLimit(t *testing.T) {
	h := newBackupHarness(t, "test-secret")
	accounts := make([]models.Account, 0, 105)
	for i := range 105 {
		accounts = append(accounts, models.Account{
			ID: fmt.Sprintf("acc-%03d", i), Provider: "cline", Label: fmt.Sprintf("key %d", i),
			AuthKind: models.AuthAPIKey, Metadata: "{}", KeyHash: fmt.Sprintf("hash-%03d", i),
		})
	}
	if err := h.app.Repos.Accounts.BulkInsert(context.Background(), accounts); err != nil {
		t.Fatal(err)
	}
	h.fiber.Get("/accounts", (&accountsHandler{app: h.app}).Index)

	count := func(query string) int {
		t.Helper()
		status, raw := h.do(t, httptest.NewRequest(http.MethodGet, "/accounts"+query, nil))
		if status != http.StatusOK {
			t.Fatalf("GET /accounts%s = %d", query, status)
		}
		var res struct {
			Data []map[string]any `json:"data"`
		}
		_ = json.Unmarshal(raw, &res)
		return len(res.Data)
	}
	if got := count(""); got != 10 {
		t.Errorf("default page = %d accounts, want 10", got)
	}
	if got := count("?limit=1000"); got != 105 {
		t.Errorf("limit=1000 = %d accounts, want all 105", got)
	}
	if got := count("?limit=100"); got != 100 {
		t.Errorf("limit=100 = %d accounts, want 100", got)
	}
}
