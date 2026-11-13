package services

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// TestParseBuddyQuota pins the credit-package split: a grant whose credits
// stop being spendable when its cycle ends is a subscription, one whose
// credits outlive the cycle is a one-off grant, and the precise (fractional)
// capacity wins over the plain one.
func TestParseBuddyQuota(t *testing.T) {
	raw := `[
		{"PackageName":"Pro","CycleStartTime":"2026-11-01 00:00:00","CycleEndTime":"2026-12-01 00:00:00",
		 "CycleCapacityUsed":"10.5","CycleCapacityUsedPrecise":"10.55","CycleCapacitySize":500,"CycleCapacitySizePrecise":"500.25",
		 "DeductionEndTime":"2026-12-01 00:00:00"},
		{"PackageName":"Pro","CycleStartTime":"2026-10-01 00:00:00","CycleEndTime":"2026-11-01 00:00:00",
		 "DeductionEndTime":"2027-06-01 00:00:00"},
		{"PackageName":"Welcome","CapacityUsed":3,"CapacitySize":20,
		 "CycleEndTime":"2026-11-20 00:00:00","DeductionEndTime":"2026-11-20 00:00:00"}
	]`
	var pkgs []buddyPackage
	if err := json.Unmarshal([]byte(raw), &pkgs); err != nil {
		t.Fatal(err)
	}
	got := ParseBuddyQuota(pkgs)
	if len(got) != 3 {
		t.Fatalf("packages = %d, want 3", len(got))
	}
	// Recurring cycles come first, soonest expiry first.
	if !got[0].Recurring || !got[1].Recurring || got[0].Name != "Monthly" || got[1].Name != "Monthly 2" {
		t.Fatalf("recurring packages = %+v, want the two Monthly cycles", got[:2])
	}
	// The larger capacity belongs to the December cycle.
	december := got[1]
	if december.Used != 10.55 || december.Size != 500.25 {
		t.Errorf("precise capacity = %v/%v, want 10.55/500.25", december.Used, december.Size)
	}
	if december.ResetAt != "2026-11-30T16:00:00Z" {
		t.Errorf("reset = %q, want the cycle end read in the vendor's own zone", december.ResetAt)
	}
	// A grant whose credits outlive its cycle is a one-off pack.
	bonus := got[2]
	if bonus.Recurring || bonus.Name != "Bonus pack 1" {
		t.Errorf("bonus = %+v, want the one-off October grant", bonus)
	}
}

// TestParseBuddyQuotaEmpty pins that an account without packages reports an
// empty list rather than nil, so the dashboard renders "no packages" instead of
// tripping over a missing array.
func TestParseBuddyQuotaEmpty(t *testing.T) {
	if got := ParseBuddyQuota(nil); got == nil || len(got) != 0 {
		t.Fatalf("empty quota = %#v, want an empty non-nil slice", got)
	}
}

// TestBuddyQuotaRequest pins the wire call: POST to the billing meter on the
// account's /v2 root, carrying the realm's client fingerprint.
func TestBuddyQuotaRequest(t *testing.T) {
	var seen http.Header
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		seen = r.Header.Clone()
		if r.Method != http.MethodPost || r.URL.Path != "/v2/billing/meter/get-user-resource" {
			t.Errorf("quota call = %s %s", r.Method, r.URL.Path)
		}
		_, _ = w.Write([]byte(`{"code":0,"data":{"Response":{"Data":{"Accounts":[
			{"PackageName":"Pro","CycleStartTime":"2026-11-01 00:00:00","CycleEndTime":"2026-12-01 00:00:00","CycleCapacityUsed":1,"CycleCapacitySize":10,"DeductionEndTime":"2026-12-01 00:00:00"}
		]}}}}`))
	}))
	defer srv.Close()

	svc := &UpstreamService{}
	packages, err := svc.BuddyQuota(context.Background(), srv.URL+"/v2", "tok", "codebuddy-cn")
	if err != nil {
		t.Fatalf("quota: %v", err)
	}
	if len(packages) != 1 || packages[0].Name != "Monthly" {
		t.Fatalf("packages = %+v, want one monthly cycle", packages)
	}
	if seen.Get("X-Domain") != "copilot.tencent.com" {
		t.Errorf("X-Domain = %q, want the CN realm", seen.Get("X-Domain"))
	}
	if !strings.HasPrefix(seen.Get("Authorization"), "Bearer ") {
		t.Errorf("Authorization = %q, want a bearer token", seen.Get("Authorization"))
	}
}

// TestListBuddyModels pins the config read: the /v2 gateway prefix is dropped
// for the host-rooted config endpoint, and only non-empty ids are returned.
func TestListBuddyModels(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v3/config" {
			t.Errorf("config call = %s, want /v3/config", r.URL.Path)
		}
		if got := r.Header.Get("X-IDE-Type"); got != "WorkBuddy" {
			t.Errorf("X-IDE-Type = %q, want the WorkBuddy identity", got)
		}
		_, _ = w.Write([]byte(`{"code":0,"data":{"models":[{"id":"glm-5.2"},{"id":""},{"id":"claude-sonnet-4"}]}}`))
	}))
	defer srv.Close()

	svc := &UpstreamService{}
	models, err := svc.ListBuddyModels(context.Background(), srv.URL+"/v2", "tok", "workbuddy")
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if len(models) != 2 || models[0].ID != "glm-5.2" || models[1].ID != "claude-sonnet-4" {
		t.Fatalf("models = %+v, want the two non-empty ids", models)
	}
}

// TestListBuddyModelsRejectsBadCode pins that an envelope error is reported as
// an error instead of yielding an empty catalog.
func TestListBuddyModelsRejectsBadCode(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`{"code":11140,"msg":"account restricted"}`))
	}))
	defer srv.Close()

	if _, err := (&UpstreamService{}).ListBuddyModels(context.Background(), srv.URL+"/v2", "tok", "codebuddy"); err == nil {
		t.Fatal("a rejected config read returned no error")
	}
}
