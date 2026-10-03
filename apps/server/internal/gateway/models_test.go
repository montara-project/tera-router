package gateway

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"

	"tera-router/server/internal/models"
)

// handleListModels advertises active aliases, the auto-combo ids, and enabled
// chains — each bare name once, shadowed or non-resolving names excluded —
// so every listed id resolves to the route its owned_by claims.
func TestHandleListModelsAdvertisesAliasesCombosChains(t *testing.T) {
	fiberApp, application := newGatewayApp(t)

	ctx := context.Background()
	must := func(err error, what string) {
		t.Helper()
		if err != nil {
			t.Fatalf("%s: %v", what, err)
		}
	}

	// Aliases: one active (the one clients may call), one inactive, one that
	// shadows an enabled chain of the same name.
	must(application.Repos.Aliases.Upsert(ctx, models.ModelAlias{
		ID: "alias-1", Name: "sonnet", Active: true,
		Targets: []models.AliasTarget{{ID: "at-1", Position: 0, Provider: "prov", Model: "claude-sonnet", Active: true}},
	}), "upsert active alias")
	must(application.Repos.Aliases.Upsert(ctx, models.ModelAlias{ID: "alias-2", Name: "ghost", Active: false}),
		"upsert inactive alias")
	must(application.Repos.Aliases.Upsert(ctx, models.ModelAlias{
		ID: "alias-3", Name: "shadowed-chain", Active: true,
		Targets: []models.AliasTarget{{ID: "at-3", Position: 0, Provider: "prov", Model: "m", Active: true}},
	}), "upsert shadowing alias")

	// Chains: resolvable, fallback-only, disabled, named into the auto-combo
	// prefix, shaped like provider/model, shaped like a chain: reference,
	// shadowed by the alias above, and without any target.
	chains := []models.Chain{
		{ID: "chain-1", Name: "budget", Strategy: "priority", Enabled: true,
			Steps: []models.ChainStep{{ID: "cs-1", Position: 0, Provider: "prov", Model: "cheap"}}},
		{ID: "chain-2", Name: "fallback-only", Strategy: "priority", Enabled: true,
			FallbackProvider: "prov", FallbackModel: "fb"},
		{ID: "chain-3", Name: "off-chain", Strategy: "priority", Enabled: false,
			Steps: []models.ChainStep{{ID: "cs-3", Position: 0, Provider: "prov", Model: "m"}}},
		{ID: "chain-4", Name: "auto", Strategy: "priority", Enabled: true,
			Steps: []models.ChainStep{{ID: "cs-4", Position: 0, Provider: "prov", Model: "m"}}},
		{ID: "chain-5", Name: "prov/thing", Strategy: "priority", Enabled: true,
			Steps: []models.ChainStep{{ID: "cs-5", Position: 0, Provider: "prov", Model: "m"}}},
		{ID: "chain-6", Name: "chain:weird", Strategy: "priority", Enabled: true,
			Steps: []models.ChainStep{{ID: "cs-6", Position: 0, Provider: "prov", Model: "m"}}},
		{ID: "chain-7", Name: "shadowed-chain", Strategy: "priority", Enabled: true,
			Steps: []models.ChainStep{{ID: "cs-7", Position: 0, Provider: "prov", Model: "m"}}},
		{ID: "chain-8", Name: "empty-chain", Strategy: "priority", Enabled: true},
	}
	for _, chain := range chains {
		must(application.Repos.Chains.Insert(ctx, chain), "insert chain "+chain.Name)
	}

	resp := do(t, fiberApp, http.MethodGet, "/v1/models", "", map[string]string{
		"Authorization": "Bearer " + testKeyPlaintext,
	})
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("GET /v1/models: status %d, body %s", resp.StatusCode, readBody(t, resp))
	}

	var body struct {
		Object string       `json:"object"`
		Data   []modelEntry `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("decode listing: %v", err)
	}
	resp.Body.Close()
	if body.Object != "list" {
		t.Errorf("object = %q, want list", body.Object)
	}

	entries := make(map[string]modelEntry, len(body.Data))
	for _, e := range body.Data {
		if prev, dup := entries[e.ID]; dup {
			t.Errorf("duplicate listing id %q (owned_by %q and %q)", e.ID, prev.OwnedBy, e.OwnedBy)
		}
		entries[e.ID] = e
	}

	for _, id := range []string{
		"sonnet", "shadowed-chain",
		"auto", "auto/coding", "auto/fast", "auto/cheap", "auto/offline", "auto/smart", "auto/lkgp",
		"budget", "fallback-only",
	} {
		if _, ok := entries[id]; !ok {
			t.Errorf("expected id %q in listing", id)
		}
	}
	for _, id := range []string{"ghost", "off-chain", "prov/thing", "chain:weird", "empty-chain"} {
		if _, ok := entries[id]; ok {
			t.Errorf("id %q must not be advertised", id)
		}
	}

	if e := entries["sonnet"]; e.OwnedBy != "alias" {
		t.Errorf("sonnet owned_by = %q, want alias", e.OwnedBy)
	}
	if e := entries["shadowed-chain"]; e.OwnedBy != "alias" {
		t.Errorf("shadowed-chain owned_by = %q, want alias (the alias wins in resolution)", e.OwnedBy)
	}
	if e := entries["auto"]; e.OwnedBy != "auto-combo" {
		t.Errorf("auto owned_by = %q, want auto-combo (the combo wins in resolution)", e.OwnedBy)
	}
	if e := entries["budget"]; e.OwnedBy != "chain" {
		t.Errorf("budget owned_by = %q, want chain", e.OwnedBy)
	}
	if e := entries["budget"]; e.Created == 0 {
		t.Error("budget created timestamp missing")
	}
}
