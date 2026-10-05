package guardrails

import (
	"testing"

	"tera-router/server/internal/models"
)

func TestMergeMostSpecificEnablingLayerWins(t *testing.T) {
	// Most specific first: the key layer tunes PII and leaves injection off;
	// the global layer enables both.
	policies := []models.GuardrailPolicy{
		{Scope: "key", Config: `{"pii":{"enabled":true,"masking_strategy":"mask"},"injection":{"enabled":false}}`},
		{Scope: "global", Config: `{"pii":{"enabled":true,"masking_strategy":"redact"},"injection":{"enabled":true,"action":"block"}}`},
	}

	cfg := Merge(policies)
	if cfg.Pii.MaskingStrategy != "mask" {
		t.Errorf("pii strategy = %q, want the key layer's mask", cfg.Pii.MaskingStrategy)
	}
	if !cfg.Injection.Enabled || cfg.Injection.Action != "block" {
		t.Errorf("injection = %+v, want the global layer to keep it on", cfg.Injection)
	}
}

func TestEffectiveMatchesScopeTargets(t *testing.T) {
	on := `{"bias":{"enabled":true}}`
	subject := Subject{KeyID: "k1", Chain: "c1", Models: []string{"fast", "openai/gpt-4o"}, Providers: []string{"openai"}}

	cases := []struct {
		policy models.GuardrailPolicy
		want   bool
	}{
		{models.GuardrailPolicy{Scope: "global", Config: on}, true},
		{models.GuardrailPolicy{Scope: "key", Target: "k1", Config: on}, true},
		{models.GuardrailPolicy{Scope: "key", Target: "k2", Config: on}, false},
		{models.GuardrailPolicy{Scope: "chain", Target: "c1", Config: on}, true},
		{models.GuardrailPolicy{Scope: "model", Target: "openai/gpt-4o", Config: on}, true},
		{models.GuardrailPolicy{Scope: "model", Target: "", Config: on}, false},
		{models.GuardrailPolicy{Scope: "provider", Target: "anthropic", Config: on}, false},
	}
	for _, tc := range cases {
		got := Effective([]models.GuardrailPolicy{tc.policy}, subject).Bias.Enabled
		if got != tc.want {
			t.Errorf("%s/%q applies = %v, want %v", tc.policy.Scope, tc.policy.Target, got, tc.want)
		}
	}

	// A subject without a chain must not match an empty-target chain policy.
	if Effective([]models.GuardrailPolicy{{Scope: "chain", Config: on}}, Subject{}).Bias.Enabled {
		t.Error("empty chain policy applied to a chainless request")
	}
}
