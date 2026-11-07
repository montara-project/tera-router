package oauth

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/google/uuid"
)

// The billing readout must hit balance first (control face with the device
// mid), fall back to current with bare auth, and merge entitlements with
// usage into per-grant rows.
func TestZcodePlanQuotaBalance(t *testing.T) {
	var balanceQuery, balanceMid, currentSeen string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch {
		case strings.HasSuffix(r.URL.Path, "/billing/balance"):
			balanceQuery = r.URL.RawQuery
			balanceMid = r.Header.Get("x-device-mid")
			io.WriteString(w, `{"code":0,"data":{
				"server_time":1730000000,
				"plans":[{"plan_id":"plan-1","name":"Start Plan","status":"active","ends_at":"2026-12-01",
					"entitlements":[{"entitlement_id":"ent-flash","show_name":"GLM-5.3-Flash","grant_units":5000000,"unit_type":"tokens","meter":"prompt","period":"daily","priority":100,"capabilities":["chat","model:GLM-5.3-Flash"]}]}],
				"balances":[{"entitlement_id":"ent-flash","plan_id":"plan-1","used_units":1200000,"remaining_units":3800000,"total_units":5000000,"period_start":1729990000,"period_end":1730059200}]}
			}`)
		case strings.HasSuffix(r.URL.Path, "/billing/current"):
			currentSeen = "hit"
			io.WriteString(w, `{"code":0,"data":{"plans":[]}}`)
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	replaceZcodePlanOrigin(t, srv.URL)

	quota, err := FetchZcodePlanQuota(context.Background(), "plan-jwt", "00000000-0000-4000-8000-000000000001")
	if err != nil {
		t.Fatalf("FetchZcodePlanQuota: %v", err)
	}
	if balanceQuery == "" {
		t.Fatal("balance endpoint was not called")
	}
	if !strings.Contains(balanceQuery, "app_version=") || !strings.Contains(balanceQuery, "platform=") {
		t.Errorf("balance query = %q, want app_version & platform params", balanceQuery)
	}
	if balanceMid == "" {
		t.Error("balance request must carry x-device-mid")
	}
	if quota.Source != "balance" {
		t.Errorf("source = %q, want balance", quota.Source)
	}
	if quota.ServerTime != 1730000000 {
		t.Errorf("server_time = %d", quota.ServerTime)
	}
	if len(quota.Rows) != 1 {
		t.Fatalf("rows = %d, want 1", len(quota.Rows))
	}
	row := quota.Rows[0]
	if row.Model != "GLM-5.3-Flash" || row.PlanName != "Start Plan" || row.PlanStatus != "active" {
		t.Errorf("row identity = %q / %q / %v", row.Model, row.PlanName, row.PlanStatus)
	}
	if row.UsedUnits != 1200000.0 || row.RemainingUnits != 3800000.0 {
		t.Errorf("usage = %v used / %v remaining", row.UsedUnits, row.RemainingUnits)
	}
	// The balance row carries its own grant; the plan's grant_units is the
	// fallback, not the override.
	if row.TotalUnits != 5000000.0 {
		t.Errorf("total_units = %v", row.TotalUnits)
	}
	models := make([]string, 0, len(row.Models))
	for _, m := range row.Models {
		models = append(models, m.(string))
	}
	if len(models) != 1 || models[0] != "GLM-5.3-Flash" {
		t.Errorf("capability models = %v", models)
	}
	if currentSeen != "" {
		t.Error("current must not be called when balance succeeds")
	}
}

// A balance failure falls back to current with bare auth (no device mid —
// the control face empties current's payload), producing grant-only rows.
func TestZcodePlanQuotaFallsBackToCurrent(t *testing.T) {
	var currentMid, currentAuth string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if strings.HasSuffix(r.URL.Path, "/billing/balance") {
			w.WriteHeader(http.StatusInternalServerError)
			io.WriteString(w, `{"code":500,"msg":"boom"}`)
			return
		}
		if strings.HasSuffix(r.URL.Path, "/billing/current") {
			currentMid = r.Header.Get("x-device-mid")
			currentAuth = r.Header.Get("authorization")
			io.WriteString(w, `{"code":0,"data":{"plans":[{"plan_id":"plan-1","name":"Start Plan","status":"active",
				"entitlements":[{"entitlement_id":"ent-flash","show_name":"GLM-5.3-Flash","grant_units":5000000,"unit_type":"tokens","period":"daily"}]}]}}`)
			return
		}
		w.WriteHeader(http.StatusNotFound)
	}))
	replaceZcodePlanOrigin(t, srv.URL)

	quota, err := FetchZcodePlanQuota(context.Background(), "plan-jwt", "00000000-0000-4000-8000-000000000001")
	if err != nil {
		t.Fatalf("FetchZcodePlanQuota: %v", err)
	}
	if quota.Source != "current" {
		t.Errorf("source = %q, want current", quota.Source)
	}
	if currentMid != "" {
		t.Error("current must be called with bare auth (no x-device-mid)")
	}
	if currentAuth != "Bearer plan-jwt" {
		t.Errorf("current auth = %q", currentAuth)
	}
	if len(quota.Errors) == 0 || !strings.Contains(quota.Errors[0], "balance") {
		t.Errorf("errors = %v, want the balance failure recorded", quota.Errors)
	}
	if len(quota.Rows) != 1 {
		t.Fatalf("rows = %d, want 1 grant-only row", len(quota.Rows))
	}
	row := quota.Rows[0]
	if row.Model != "GLM-5.3-Flash" || row.PlanName != "Start Plan" {
		t.Errorf("grant-only row = %+v", row)
	}
	if row.TotalUnits != 5000000.0 || row.UsedUnits != nil {
		t.Errorf("grant-only usage = total %v / used %v", row.TotalUnits, row.UsedUnits)
	}
}

func TestZcodeDeviceMidStable(t *testing.T) {
	a := ZcodeDeviceMid("acc-1")
	b := ZcodeDeviceMid("acc-1")
	if a != b {
		t.Error("device mid must be deterministic per account")
	}
	if _, err := uuid.Parse(a); err != nil {
		t.Errorf("device mid = %q, want a parseable uuid", a)
	}
	if ZcodeDeviceMid("acc-2") == a {
		t.Error("different accounts must derive different device mids")
	}
}

// replaceZcodePlanOrigin points the fetcher at a stub server for the test's
// lifetime; the previous origin is restored via t.Cleanup.
func replaceZcodePlanOrigin(t *testing.T, url string) {
	t.Helper()
	prev := zcodePlanOrigin
	zcodePlanOrigin = url
	t.Cleanup(func() { zcodePlanOrigin = prev })
}
