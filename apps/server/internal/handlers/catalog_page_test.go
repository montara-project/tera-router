package handlers

import (
	"fmt"
	"testing"

	"tera-router/server/internal/modelcatalog"
)

func TestCatalogPageFilterAndSlice(t *testing.T) {
	models := []modelcatalog.ModelEntry{
		{ID: "deepseek-v4.1-flash", State: modelcatalog.StateActive},
		{ID: "deepseek-reasoner", State: modelcatalog.StateDisabled},
		{ID: "glm-5", State: modelcatalog.StateActive},
		{ID: "glm-5-air", State: modelcatalog.StateActive},
		{ID: "qwen3-max", State: modelcatalog.StateDisabled},
	}

	// Unpaged: everything, with totals over the whole catalog.
	page, total, enabled := catalogPage(models, "", "", 0, 0)
	if total != 5 || enabled != 3 {
		t.Fatalf("total=%d enabled=%d, want 5/3", total, enabled)
	}
	if len(page) != 5 {
		t.Fatalf("page = %d rows, want 5 when limit is unset (default 10)", len(page))
	}

	// Substring search is case-insensitive and reports the filtered total.
	page, total, _ = catalogPage(models, "GLM-", "", 0, 0)
	if total != 2 || len(page) != 2 || page[0].ID != "glm-5" {
		t.Fatalf("glm search: total=%d page=%v, want 2 rows starting at glm-5", total, page)
	}

	// State narrows before paging: only active rows count toward total.
	page, total, enabled = catalogPage(models, "", modelcatalog.StateActive, 0, 0)
	if total != 3 || enabled != 3 || len(page) != 3 {
		t.Fatalf("active state: total=%d enabled=%d rows=%d, want 3/3/3", total, enabled, len(page))
	}
	for _, m := range page {
		if m.State != modelcatalog.StateActive {
			t.Fatalf("active state page contains %q with state %q", m.ID, m.State)
		}
	}

	// Search and state compose.
	page, total, _ = catalogPage(models, "deepseek", modelcatalog.StateActive, 0, 0)
	if total != 1 || len(page) != 1 || page[0].ID != "deepseek-v4.1-flash" {
		t.Fatalf("active+deepseek: total=%d page=%v, want only deepseek-v4.1-flash", total, page)
	}

	// A state value that is not active/disabled keeps both — same as omitting it.
	page, total, _ = catalogPage(models, "", "enabled", 0, 0)
	if total != 5 || len(page) != 5 {
		t.Fatalf("unknown state: total=%d rows=%d, want 5 (no filtering)", total, len(page))
	}

	// Page 2 of a 2-row result is empty but not an error.
	page, total, _ = catalogPage(models, "deepseek", "", 10, 10)
	if total != 2 || len(page) != 0 {
		t.Fatalf("deepseek page 2: total=%d rows=%d, want 2 and an empty page", total, len(page))
	}

	// Offset beyond the end is clamped, not an error.
	page, _, _ = catalogPage(models, "", "", 999, 10)
	if len(page) != 0 {
		t.Fatalf("offset clamp: rows = %d, want 0", len(page))
	}

	// A limit above the cap is clamped so one page stays bounded.
	page, _, _ = catalogPage(models, "", "", 0, 100000)
	if len(page) != 5 {
		t.Fatalf("limit cap: rows = %d, want 5 (catalog smaller than the cap)", len(page))
	}
}

// The alias/pricing pickers request page 1 of a catalog whose active models
// may all live past the page cap; the state filter must surface them anyway.
func TestCatalogPageStateFilterSurfacesActivesBeyondFirstPage(t *testing.T) {
	models := make([]modelcatalog.ModelEntry, 0, 205)
	for i := 0; i < 200; i++ {
		models = append(models, modelcatalog.ModelEntry{
			ID: fmt.Sprintf("filler-model-%03d", i), State: modelcatalog.StateDisabled,
		})
	}
	activeIDs := []string{"alpha-latest", "beta-latest", "gamma-latest", "delta-latest", "epsilon-latest"}
	for _, id := range activeIDs {
		models = append(models, modelcatalog.ModelEntry{ID: id, State: modelcatalog.StateActive})
	}

	// Without the state filter, page 1 (limit 100) has no active model.
	page, total, _ := catalogPage(models, "", "", 0, 100)
	if total != 205 || len(page) != 100 {
		t.Fatalf("unfiltered: total=%d rows=%d, want 205/100", total, len(page))
	}
	for _, m := range page {
		if m.State == modelcatalog.StateActive {
			t.Fatalf("unfiltered page 1 unexpectedly contains active %q", m.ID)
		}
	}

	// With it, one page holds every active model.
	page, total, _ = catalogPage(models, "", modelcatalog.StateActive, 0, 100)
	if total != 5 || len(page) != 5 {
		t.Fatalf("active-filtered: total=%d rows=%d, want 5/5", total, len(page))
	}
	for i, m := range page {
		if m.ID != activeIDs[i] {
			t.Fatalf("active page[%d] = %q, want %q", i, m.ID, activeIDs[i])
		}
	}
}
