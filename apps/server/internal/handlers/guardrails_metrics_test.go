package handlers

import (
	"context"
	"encoding/json"
	"net/http/httptest"
	"path/filepath"
	"testing"
	"time"

	"tera-router/server/internal/app"
	"tera-router/server/internal/config"
	"tera-router/server/internal/database"
	"tera-router/server/internal/middlewares"
	"tera-router/server/internal/migrator"
	"tera-router/server/internal/models"
	"tera-router/server/internal/repositories"

	"github.com/gofiber/fiber/v3"
)

// TestMetricsFoldsDecisions pins that the overview aggregates the window's
// gateway decisions: the per-kind counters, the hourly series, the detector,
// key, model, reason and entity breakdowns, and the screen duration.
func TestMetricsFoldsDecisions(t *testing.T) {
	db, err := database.Open(filepath.Join(t.TempDir(), "guardrails_metrics_test.db"))
	if err != nil {
		t.Fatalf("open database: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	if err := migrator.Up(db, "../../migrations"); err != nil {
		t.Fatalf("migrate: %v", err)
	}

	cfg := config.Config{App: config.ConfigApp{Secret: "test-secret"}}
	a := &app.Application{Config: cfg, DB: db, Repos: repositories.New(db, &cfg.App)}
	h := &guardrailsHandler{app: a}

	f := fiber.New(fiber.Config{ErrorHandler: middlewares.ErrorHandler})
	f.Get("/v1/guardrails/metrics", h.Metrics)

	ctx := context.Background()
	insert := func(id, action, model, detail string, at time.Time) {
		t.Helper()
		entry := models.AuditEntry{
			ID: id, Actor: "key:prod-key", Action: action, Target: model,
			Detail:    detail,
			CreatedAt: at,
		}
		if err := a.Repos.Audit.Insert(ctx, entry); err != nil {
			t.Fatalf("insert %s: %v", id, err)
		}
	}
	now := time.Now().UTC()
	insert("d1", "guardrail.block", "openai/gpt-4o",
		`{"detectors":["injection","pii"],"entities":["EMAIL_ADDRESS"],"reasons":["injection_pattern"],"overhead_ms":2,"key_id":"k1"}`, now.Add(-30*time.Minute))
	insert("d2", "guardrail.mask", "openai/gpt-4o",
		`{"detectors":["pii"],"entities":["ID_NIK","EMAIL_ADDRESS"],"reasons":["ID_NIK"],"overhead_ms":4,"key_id":"k1"}`, now.Add(-20*time.Minute))
	insert("d3", "guardrail.warn", "anthropic/claude-3",
		`{"detectors":["toxicity"],"entities":[],"reasons":["profanity"],"overhead_ms":6,"key_id":"k2"}`, now.Add(-10*time.Minute))
	insert("d4", "guardrail.log", "anthropic/claude-3",
		`{"detectors":["topics"],"entities":[],"reasons":["off_topic"],"overhead_ms":0,"key_id":"k2"}`, now.Add(-5*time.Minute))
	// A policy edit shares the action prefix but is not a decision.
	insert("d5", "guardrail.policy.update", "",
		`{"name":"Global Guardrails"}`, now.Add(-2*time.Minute))

	req := httptest.NewRequest("GET", "/v1/guardrails/metrics?range=24h", nil)
	resp, err := f.Test(req)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != 200 {
		t.Fatalf("status = %d", resp.StatusCode)
	}

	var body struct {
		Data struct {
			Hourly   bool  `json:"hourly"`
			Checked  int64 `json:"checked"`
			Blocked  int64 `json:"blocked"`
			Masked   int64 `json:"masked"`
			Warned   int64 `json:"warned"`
			Logged   int64 `json:"logged"`
			Overhead struct {
				Samples int64 `json:"samples"`
				P50     int64 `json:"p50"`
				P95     int64 `json:"p95"`
				Avg     int64 `json:"avg"`
			} `json:"overhead"`
			Series []struct {
				Blocked int64 `json:"blocked"`
				Masked  int64 `json:"masked"`
				Warned  int64 `json:"warned"`
				Logged  int64 `json:"logged"`
			} `json:"series"`
			Detectors []struct{ Key, Label string } `json:"detectors"`
			Reasons   []struct{ Key string }        `json:"reasons"`
			Keys      []struct{ Label string }      `json:"keys"`
			Models    []struct{ Label string }      `json:"models"`
			Entities  []struct{ Key string }        `json:"entities"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	d := body.Data

	if !d.Hourly {
		t.Error("24h must bucket hourly")
	}
	if d.Blocked != 1 || d.Masked != 1 || d.Warned != 1 || d.Logged != 1 {
		t.Errorf("counters = %d/%d/%d/%d, want 1/1/1/1", d.Blocked, d.Masked, d.Warned, d.Logged)
	}
	// No usage rows and no allowed requests: the four decisions are the floor.
	if d.Checked != 4 {
		t.Errorf("checked = %d, want 4", d.Checked)
	}
	// The zero-duration decision is skipped, so the sample is [2, 4, 6].
	if d.Overhead.Samples != 3 || d.Overhead.Avg != 4 {
		t.Errorf("overhead = %+v", d.Overhead)
	}

	var series struct{ blocked, masked, warned, logged int64 }
	for _, point := range d.Series {
		series.blocked += point.Blocked
		series.masked += point.Masked
		series.warned += point.Warned
		series.logged += point.Logged
	}
	if series.blocked != 1 || series.masked != 1 || series.warned != 1 || series.logged != 1 {
		t.Errorf("series totals = %+v", series)
	}

	if len(d.Detectors) != 4 || d.Detectors[0].Key != "injection" && d.Detectors[0].Key != "pii" {
		t.Errorf("detectors = %+v", d.Detectors)
	}
	if len(d.Reasons) != 4 {
		t.Errorf("reasons = %+v", d.Reasons)
	}
	if len(d.Keys) != 2 || len(d.Models) != 2 {
		t.Errorf("keys = %+v, models = %+v", d.Keys, d.Models)
	}
	if len(d.Entities) != 2 || d.Entities[0].Key != "EMAIL_ADDRESS" {
		t.Errorf("entities = %+v", d.Entities)
	}
}
