package handlers

import (
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
	page, total, enabled := catalogPage(models, "", 0, 0)
	if total != 5 || enabled != 3 {
		t.Fatalf("total=%d enabled=%d, want 5/3", total, enabled)
	}
	if len(page) != 5 {
		t.Fatalf("page = %d rows, want 5 when limit is unset (default 10)", len(page))
	}

	// Substring search is case-insensitive and reports the filtered total.
	page, total, _ = catalogPage(models, "GLM-", 0, 0)
	if total != 2 || len(page) != 2 || page[0].ID != "glm-5" {
		t.Fatalf("glm search: total=%d page=%v, want 2 rows starting at glm-5", total, page)
	}

	// Page 2 of a 2-row result is empty but not an error.
	page, total, _ = catalogPage(models, "deepseek", 10, 10)
	if total != 2 || len(page) != 0 {
		t.Fatalf("deepseek page 2: total=%d rows=%d, want 2 and an empty page", total, len(page))
	}

	// Offset beyond the end is clamped, not an error.
	page, _, _ = catalogPage(models, "", 999, 10)
	if len(page) != 0 {
		t.Fatalf("offset clamp: rows = %d, want 0", len(page))
	}

	// A limit above the cap is clamped so one page stays bounded.
	page, _, _ = catalogPage(models, "", 0, 100000)
	if len(page) != 5 {
		t.Fatalf("limit cap: rows = %d, want 5 (catalog smaller than the cap)", len(page))
	}
}
