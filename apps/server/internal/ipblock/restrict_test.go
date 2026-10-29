package ipblock

import (
	"context"
	"net/netip"
	"testing"
	"time"

	"tera-router/server/internal/models"
)

func TestRestrictionWindow(t *testing.T) {
	// 2026-10-29 15:30 UTC is 22:30 in Asia/Jakarta.
	now := time.Date(2026, 10, 29, 15, 30, 0, 0, time.UTC)
	cases := []struct {
		name string
		r    models.RestrictedAccess
		want bool
	}{
		{"disabled", models.RestrictedAccess{StartDate: "2026-10-01"}, false},
		{"always", models.RestrictedAccess{Enabled: true}, true},
		{"inside dates", models.RestrictedAccess{Enabled: true, StartDate: "2026-10-29", EndDate: "2026-10-29"}, true},
		{"before start", models.RestrictedAccess{Enabled: true, StartDate: "2026-10-30"}, false},
		{"after end", models.RestrictedAccess{Enabled: true, EndDate: "2026-10-28"}, false},
		{"inside hours", models.RestrictedAccess{Enabled: true, StartTime: "09:00", EndTime: "17:00"}, true},
		{"end exclusive", models.RestrictedAccess{Enabled: true, StartTime: "09:00", EndTime: "15:30"}, false},
		{"outside hours", models.RestrictedAccess{Enabled: true, StartTime: "16:00", EndTime: "17:00"}, false},
		{"overnight", models.RestrictedAccess{Enabled: true, StartTime: "22:00", EndTime: "06:00"}, false},
		{"overnight in zone", models.RestrictedAccess{Enabled: true, StartTime: "22:00", EndTime: "06:00", Timezone: "Asia/Jakarta"}, true},
		{"zone shifts date", models.RestrictedAccess{Enabled: true, EndDate: "2026-10-29", Timezone: "Pacific/Kiritimati"}, false},
	}
	for _, tc := range cases {
		r, _, err := CompileRestriction(tc.r)
		if err != nil {
			t.Fatalf("%s: %v", tc.name, err)
		}
		if got := r.Active(now); got != tc.want {
			t.Errorf("%s: Active = %v, want %v", tc.name, got, tc.want)
		}
	}
}

func TestCompileRestrictionRejectsBadInput(t *testing.T) {
	for _, r := range []models.RestrictedAccess{
		{StartDate: "29-10-2026"},
		{StartDate: "2026-10-30", EndDate: "2026-10-29"},
		{StartTime: "9am", EndTime: "17:00"},
		{StartTime: "09:00"},
		{StartTime: "09:00", EndTime: "09:00"},
		{Timezone: "Mars/Olympus"},
		{AllowedIPs: []string{"not-an-ip"}},
	} {
		if _, _, err := CompileRestriction(r); err == nil {
			t.Errorf("%+v: want error", r)
		}
	}
	_, stored, err := CompileRestriction(models.RestrictedAccess{AllowedIPs: []string{"10.1.2.3/8", "10.0.0.0/8", "::ffff:203.0.113.7"}})
	if err != nil {
		t.Fatal(err)
	}
	if len(stored.AllowedIPs) != 2 || stored.AllowedIPs[0] != "10.0.0.0/8" || stored.AllowedIPs[1] != "203.0.113.7/32" {
		t.Fatalf("canonical allowlist = %v", stored.AllowedIPs)
	}
}

func TestGuardRestricted(t *testing.T) {
	g, _ := newGuard(t)
	ctx := context.Background()
	if err := g.settings.SetRestrictedAccess(ctx, models.RestrictedAccess{Enabled: true, AllowedIPs: []string{"10.0.0.0/8"}}); err != nil {
		t.Fatal(err)
	}
	if err := g.Reload(ctx); err != nil {
		t.Fatal(err)
	}
	now := time.Now()
	for ip, want := range map[string]bool{"10.9.9.9": false, "203.0.113.7": true, "127.0.0.1": false, "::1": false} {
		if got := g.Restricted(netip.MustParseAddr(ip), now); got != want {
			t.Errorf("Restricted(%s) = %v, want %v", ip, got, want)
		}
	}
}
