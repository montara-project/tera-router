package handlers

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"tera-router/server/internal/models"
	"tera-router/server/internal/services"

	"github.com/google/uuid"

	"github.com/gofiber/fiber/v3"
)

// TestBuddyQuotaRoute pins the buddy quota branch: the account's base_url
// override is used, the meter is read with the realm's client fingerprint, and
// the credit packages come back in the dashboard's shape.
func TestBuddyQuotaRoute(t *testing.T) {
	var seen http.Header
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		seen = r.Header.Clone()
		if r.URL.Path != "/v2/billing/meter/get-user-resource" {
			t.Errorf("meter path = %s", r.URL.Path)
		}
		_, _ = w.Write([]byte(`{"code":0,"data":{"Response":{"Data":{"Accounts":[
			{"PackageName":"Pro","CycleStartTime":"2026-11-01 00:00:00","CycleEndTime":"2026-12-01 00:00:00",
			 "CycleCapacityUsed":"2.5","CycleCapacitySize":"100","DeductionEndTime":"2026-12-01 00:00:00"}
		]}}}}`))
	}))
	defer srv.Close()

	h := newBackupHarness(t, "buddy-quota").withAccountPortfolio()
	h.app.Services = services.New()
	acc := models.Account{ID: uuid.NewString(), Provider: "workbuddy", Label: "work", AuthKind: models.AuthAPIKey,
		Metadata: `{"base_url":"` + srv.URL + `/v2"}`, Priority: 100}
	if err := sealCredential(h.app, &acc, accountInput{APIKey: "sk-workbuddy-key-0001"}); err != nil {
		t.Fatal(err)
	}
	if err := h.app.Repos.Accounts.Insert(context.Background(), acc); err != nil {
		t.Fatal(err)
	}

	h.fiber.Get("/accounts/:id/quota", (&accountsHandler{app: h.app}).Quota)
	req := httptest.NewRequest(http.MethodGet, "/accounts/"+acc.ID+"/quota", nil)
	resp, err := h.fiber.Test(req, fiber.TestConfig{Timeout: 0})
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		raw, _ := io.ReadAll(resp.Body)
		t.Fatalf("quota = %d (%s), want 200", resp.StatusCode, raw)
	}
	var body struct {
		Data struct {
			Visibility string `json:"quota_visibility"`
			Packages   []struct {
				Name string  `json:"name"`
				Used float64 `json:"used"`
				Size float64 `json:"size"`
			} `json:"packages"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	if body.Data.Visibility != "upstream" || len(body.Data.Packages) != 1 {
		t.Fatalf("quota body = %+v, want one upstream package", body.Data)
	}
	pkg := body.Data.Packages[0]
	if pkg.Name != "Monthly" || pkg.Used != 2.5 || pkg.Size != 100 {
		t.Errorf("package = %+v, want the monthly 2.5/100 cycle", pkg)
	}
	if seen.Get("X-IDE-Type") != "WorkBuddy" || seen.Get("X-Domain") != "www.workbuddy.ai" {
		t.Errorf("client identity = %q/%q, want the WorkBuddy one", seen.Get("X-IDE-Type"), seen.Get("X-Domain"))
	}
}
