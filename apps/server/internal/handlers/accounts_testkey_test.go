package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"tera-router/server/internal/models"
	"tera-router/server/internal/repositories"
	"tera-router/server/internal/services"

	"github.com/google/uuid"
)

// TestAccountTestKeyProbesCustomProvider pins that an unsaved key is checked
// against a custom provider's own base_url, and that nothing is stored.
func TestAccountTestKeyProbesCustomProvider(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/models" || r.Header.Get("Authorization") != "Bearer sk-good" {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"data":[]}`))
	}))
	defer upstream.Close()

	h := newBackupHarness(t, "test-secret")
	h.app.Services = services.New()
	cp := models.CustomProvider{
		ID: uuid.NewString(), Name: "Holver", Slug: "custom-openai-holver",
		BaseURL: upstream.URL + "/v1", APIKind: "openai", Pricing: "{}", Metadata: "{}", Enabled: true, Priority: 100,
	}
	if err := h.app.Repos.Providers.Insert(context.Background(), cp); err != nil {
		t.Fatal(err)
	}
	h.fiber.Post("/accounts/test", (&accountsHandler{app: h.app}).TestKey)

	test := func(body string) (int, bool) {
		t.Helper()
		req := httptest.NewRequest(http.MethodPost, "/accounts/test", strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		status, raw := h.do(t, req)
		var res struct {
			Data struct {
				OK bool `json:"ok"`
			} `json:"data"`
		}
		_ = json.Unmarshal(raw, &res)
		return status, res.Data.OK
	}

	if status, ok := test(`{"provider":"custom-openai-holver","api_key":"sk-good"}`); status != http.StatusOK || !ok {
		t.Fatalf("good key = %d ok=%v, want 200 ok", status, ok)
	}
	if status, ok := test(`{"provider":"custom-openai-holver","api_key":"sk-bad"}`); status != http.StatusOK || ok {
		t.Fatalf("bad key = %d ok=%v, want 200 not ok", status, ok)
	}
	if status, _ := test(`{"provider":"custom-openai-holver"}`); status != http.StatusBadRequest {
		t.Fatalf("missing key = %d, want 400", status)
	}

	accounts, _, err := h.app.Repos.Accounts.List(context.Background(), repositories.AccountFilter{}, 0, 10)
	if err != nil {
		t.Fatal(err)
	}
	if len(accounts) != 0 {
		t.Fatalf("testing a key stored %d accounts, want 0", len(accounts))
	}
}
