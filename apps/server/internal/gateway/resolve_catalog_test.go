package gateway

import (
	"context"
	"testing"
)

// TestResolveTargetsBareModelFromCatalog covers the headline behavior of the
// stored model catalogs: a bare model id — no provider prefix — resolves to
// the custom provider serving it.
func TestResolveTargetsBareModelFromCatalog(t *testing.T) {
	s, a := newTestServer(t)

	exec(t, a, `
		INSERT INTO custom_providers (id, name, slug, base_url, api_kind, enabled, priority) VALUES
		('cp-zrouter', 'ZRouter', 'custom-openai-zrouter', 'https://zrouter.example/v1', 'openai', 1, 100)`)
	exec(t, a, `
		INSERT INTO settings (key, value) VALUES
		('provider_models_custom-openai-zrouter',
		 '{"version":1,"fetched_at":"2026-01-01T00:00:00Z","models":["deepseek-v4.1-flash","glm-5"]}')`)

	res, err := s.resolveTargets(context.Background(), "deepseek-v4.1-flash")
	if err != nil {
		t.Fatalf("resolve: %v", err)
	}
	if len(res.Targets) != 1 {
		t.Fatalf("targets = %d, want 1", len(res.Targets))
	}
	if res.Targets[0].Provider != "custom-openai-zrouter" || res.Targets[0].Model != "deepseek-v4.1-flash" {
		t.Errorf("target = %s/%s, want custom-openai-zrouter/deepseek-v4.1-flash",
			res.Targets[0].Provider, res.Targets[0].Model)
	}
	if res.EchoModel != "deepseek-v4.1-flash" {
		t.Errorf("echo = %q, want the bare id the client sent", res.EchoModel)
	}
	if res.ChainName != "" {
		t.Errorf("chain name = %q, want empty: a catalog match is not a chain", res.ChainName)
	}
}

// TestResolveTargetsBareModelFallbackOrder asserts that when several enabled
// providers serve the same bare id, the lower-priority-value provider is
// tried first and the disabled one is never routed to.
func TestResolveTargetsBareModelFallbackOrder(t *testing.T) {
	s, a := newTestServer(t)

	exec(t, a, `
		INSERT INTO custom_providers (id, name, slug, base_url, api_kind, enabled, priority) VALUES
		('cp-backup',   'Backup',   'custom-openai-backup',   'https://backup.example/v1',   'openai', 1, 200),
		('cp-disabled', 'Disabled', 'custom-openai-disabled', 'https://disabled.example/v1', 'openai', 0, 1),
		('cp-primary',  'Primary',  'custom-openai-primary',  'https://primary.example/v1',  'openai', 1, 50)`)
	for _, slug := range []string{"custom-openai-backup", "custom-openai-disabled", "custom-openai-primary"} {
		exec(t, a, `
			INSERT INTO settings (key, value) VALUES
			('provider_models_`+slug+`',
			 '{"version":1,"fetched_at":"2026-01-01T00:00:00Z","models":["glm-5"]}')`)
	}

	res, err := s.resolveTargets(context.Background(), "glm-5")
	if err != nil {
		t.Fatalf("resolve: %v", err)
	}
	if len(res.Targets) != 2 {
		t.Fatalf("targets = %d, want 2 (the disabled provider must be excluded)", len(res.Targets))
	}
	if res.Targets[0].Provider != "custom-openai-primary" {
		t.Errorf("first target = %s, want custom-openai-primary (lowest priority value)", res.Targets[0].Provider)
	}
	if res.Targets[1].Provider != "custom-openai-backup" {
		t.Errorf("second target = %s, want custom-openai-backup", res.Targets[1].Provider)
	}
}

// TestResolveTargetsUnknownBareModelStillErrors keeps the explicitness
// guarantee: a bare name that no chain, alias, or stored catalog serves is a
// client error, never an unverified upstream call.
func TestResolveTargetsUnknownBareModelStillErrors(t *testing.T) {
	s, a := newTestServer(t)
	exec(t, a, `
		INSERT INTO custom_providers (id, name, slug, base_url, api_kind, enabled, priority) VALUES
		('cp-zrouter', 'ZRouter', 'custom-openai-zrouter', 'https://zrouter.example/v1', 'openai', 1, 100)`)

	_, err := s.resolveTargets(context.Background(), "made-up-model")
	if err == nil {
		t.Fatal("expected an error for a bare id no catalog serves")
	}
	var bad badModelError
	if !asBadModel(err, &bad) {
		t.Fatalf("error %T = %v, want badModelError", err, err)
	}
}
