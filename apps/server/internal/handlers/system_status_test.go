package handlers

import (
	"testing"
	"time"

	"tera-router/server/internal/app"
)

func TestBuildSystemStatus(t *testing.T) {
	started := time.Date(2026, 10, 31, 8, 0, 0, 0, time.UTC)
	now := started.Add(14*time.Hour + 37*time.Minute + 30*time.Second)

	got := buildSystemStatus(20180, started, now)

	if got.Status != "running" {
		t.Fatalf("status = %q, want running", got.Status)
	}
	if got.UptimeSeconds != 52650 {
		t.Fatalf("uptime_seconds = %d, want 52650", got.UptimeSeconds)
	}
	if got.ListenAddr != "0.0.0.0:20180" {
		t.Fatalf("listen_addr = %q, want 0.0.0.0:20180", got.ListenAddr)
	}
	if got.Database != "SQLite" {
		t.Fatalf("database = %q, want SQLite", got.Database)
	}
	if got.Version != app.Version {
		t.Fatalf("version = %q, want %q", got.Version, app.Version)
	}
}
