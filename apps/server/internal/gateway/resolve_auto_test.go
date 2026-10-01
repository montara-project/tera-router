package gateway

import (
	"context"
	"testing"

	"tera-router/server/internal/models"
)

// TestResolveTargetsAutoCombo covers "auto"/"auto/<variant>" resolution over a
// real database: two providers with usage history, the healthier one ranked
// first, and the variant's synthetic chain name carried for access policy.
func TestResolveTargetsAutoCombo(t *testing.T) {
	s, a := newTestServer(t)
	s.combo.DisableExploration()

	exec(t, a, `INSERT INTO accounts (id, provider) VALUES ('acc-alpha', 'alpha'), ('acc-beta', 'beta')`)
	exec(t, a, `
		INSERT INTO usage_records (provider, model, failed, latency_ms) VALUES
		('alpha', 'model-a', 0, 200),
		('alpha', 'model-a', 0, 200),
		('beta',  'model-b', 1, 2000),
		('beta',  'model-b', 1, 2000)`)

	res, err := s.resolveTargets(context.Background(), "auto")
	if err != nil {
		t.Fatalf("resolve auto: %v", err)
	}
	if len(res.Targets) != 2 {
		t.Fatalf("targets = %d, want 2", len(res.Targets))
	}
	if res.Targets[0].Provider != "alpha" || res.Targets[0].Model != "model-a" {
		t.Errorf("first target = %s/%s, want alpha/model-a (healthy beats failing)", res.Targets[0].Provider, res.Targets[0].Model)
	}
	if res.Targets[1].Provider != "beta" {
		t.Errorf("second target = %s, want beta", res.Targets[1].Provider)
	}
	if res.ChainName != "auto" {
		t.Errorf("chain name = %q, want auto", res.ChainName)
	}
	if res.EchoModel != "auto" {
		t.Errorf("echo = %q, want the requested id", res.EchoModel)
	}
	if res.Strategy != strategyPriority {
		t.Errorf("strategy = %q, want priority", res.Strategy)
	}

	named, err := s.resolveTargets(context.Background(), "auto/fast")
	if err != nil {
		t.Fatalf("resolve auto/fast: %v", err)
	}
	if named.ChainName != "auto/fast" || named.EchoModel != "auto/fast" {
		t.Errorf("chain/echo = %q/%q, want auto/fast for both", named.ChainName, named.EchoModel)
	}
}

// TestResolveTargetsAutoComboNoUsage asserts the documented limitation: a
// provider pool without observed usage builds an empty combo, which surfaces
// as a bad-model error.
func TestResolveTargetsAutoComboNoUsage(t *testing.T) {
	s, a := newTestServer(t)
	exec(t, a, `INSERT INTO accounts (id, provider) VALUES ('acc-alpha', 'alpha')`)

	_, err := s.resolveTargets(context.Background(), "auto")
	if err == nil {
		t.Fatal("expected an error for a pool with no observed usage")
	}
	var bad badModelError
	if !asBadModel(err, &bad) {
		t.Fatalf("error %T = %v, want badModelError", err, err)
	}
}

// TestAllowlistGrantsAutoVariant asserts that an operator can allowlist an
// auto-combo variant by its synthetic chain name, mirroring how chains grant
// their whole target list.
func TestAllowlistGrantsAutoVariant(t *testing.T) {
	targets := []target{
		{Provider: "alpha", Model: "model-a"},
		{Provider: "beta", Model: "model-b"},
	}

	allowed := filterAllowedTargets(models.APIKey{}, targets, "auto/fast", []string{"auto/fast"})
	if len(allowed) != len(targets) {
		t.Fatalf("allowed = %d, want the whole combo for an allowlisted variant", len(allowed))
	}

	denied := filterAllowedTargets(models.APIKey{}, targets, "auto/fast", []string{"other-chain"})
	if len(denied) != 0 {
		t.Fatalf("allowed = %d, want none for an unrelated allowlist", len(denied))
	}
}
