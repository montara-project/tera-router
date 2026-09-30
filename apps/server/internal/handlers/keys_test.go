package handlers

import (
	"testing"
	"time"

	"tera-router/server/internal/models"
	"tera-router/server/internal/repositories"
)

// keyView is the contract the web UI's ApiKey model mirrors, so its field names
// and its nil-vs-empty handling are pinned here: the detail page renders
// allowed_models directly and would break on a null.

func strptr(s string) *string { return &s }

func TestKeyViewDefaultsWithoutPlan(t *testing.T) {
	view := keyView(repositories.APIKeyWithPlan{
		APIKey: models.APIKey{
			ID:        "k1",
			Name:      "Dev",
			Display:   "kr_qk5o…EwP8",
			CreatedAt: time.Date(2026, 9, 7, 11, 4, 55, 0, time.UTC),
		},
	})

	if view["plan_label"] != "No plan" {
		t.Errorf("plan_label = %v, want No plan", view["plan_label"])
	}
	if view["plan_note"] != "Custom limits" {
		t.Errorf("plan_note = %v, want Custom limits", view["plan_note"])
	}
	if view["status"] != "active" {
		t.Errorf("status = %v, want active", view["status"])
	}

	models_, ok := view["allowed_models"].([]string)
	if !ok {
		t.Fatalf("allowed_models = %#v, want []string", view["allowed_models"])
	}
	if len(models_) != 0 {
		t.Errorf("allowed_models = %v, want empty", models_)
	}
}

func TestKeyViewRendersPlanAndDisabled(t *testing.T) {
	view := keyView(repositories.APIKeyWithPlan{
		APIKey: models.APIKey{
			ID:            "k2",
			Name:          "Prod",
			Display:       "kr_prod…1234",
			Disabled:      true,
			AllowedModels: []string{"gpt-4o", "claude-*"},
		},
		PlanName: strptr("Team"),
		PlanNote: strptr("Shared budget"),
	})

	if view["status"] != "disabled" {
		t.Errorf("status = %v, want disabled", view["status"])
	}
	if view["plan_label"] != "Team" {
		t.Errorf("plan_label = %v, want Team", view["plan_label"])
	}
	if view["plan_note"] != "Shared budget" {
		t.Errorf("plan_note = %v, want Shared budget", view["plan_note"])
	}

	got, ok := view["allowed_models"].([]string)
	if !ok || len(got) != 2 || got[0] != "gpt-4o" || got[1] != "claude-*" {
		t.Errorf("allowed_models = %#v, want [gpt-4o claude-*]", view["allowed_models"])
	}
}

// An empty plan note falls back to the generic label rather than rendering a
// blank line under the plan name.
func TestKeyViewFallsBackOnEmptyPlanNote(t *testing.T) {
	view := keyView(repositories.APIKeyWithPlan{
		APIKey:   models.APIKey{ID: "k3", Name: "Empty note"},
		PlanName: strptr("Basic"),
		PlanNote: strptr(""),
	})

	if view["plan_note"] != "Plan defaults" {
		t.Errorf("plan_note = %v, want Plan defaults", view["plan_note"])
	}
}
