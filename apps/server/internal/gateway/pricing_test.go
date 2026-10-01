package gateway

import (
	"context"
	"testing"

	"tera-router/server/internal/models"
)

// pricingFor is the gateway's pricing verdict: cost rates plus the budget
// drain multiplier. Overrides win over the compiled-in retail table, and only
// overrides carry a token rate — the retail table never drains differently.
func TestPricingForResolvesOverrideWithReasoningAndTokenRate(t *testing.T) {
	s, app := newTestServer(t)
	rate := 2.5
	if err := app.Repos.Pricing.Upsert(context.Background(), models.PricingOverride{
		ID: "po-1", Provider: "openai", Model: "o3",
		InputMicros: 2_000_000, OutputMicros: 8_000_000, ReasoningMicros: 8_000_000,
		TokenConsumptionRate: &rate,
	}); err != nil {
		t.Fatalf("seed override: %v", err)
	}

	rates, tokenRate := s.pricingFor(context.Background(), "openai", "o3")
	if rates.OutputMicros != 8_000_000 || rates.ReasoningMicros != 8_000_000 {
		t.Fatalf("rates = %+v, want override rates with reasoning", rates)
	}
	if tokenRate == nil || *tokenRate != 2.5 {
		t.Fatalf("tokenRate = %v, want 2.5", tokenRate)
	}
}

// A model the compiled-in table prices still drains token budgets 1:1 unless
// an operator override says otherwise.
func TestPricingForTokenRateOnlyComesFromOverrides(t *testing.T) {
	s, _ := newTestServer(t)

	rates, tokenRate := s.pricingFor(context.Background(), "openai", "gpt-4o")
	if rates.OutputMicros == 0 {
		t.Fatalf("rates = %+v, want compiled-in retail rates", rates)
	}
	if tokenRate != nil {
		t.Fatalf("tokenRate = %v, want nil (retail table carries no token rate)", *tokenRate)
	}
}

func TestPricingForFallsBackToProviderLevelOverride(t *testing.T) {
	s, app := newTestServer(t)
	free := 0.0
	if err := app.Repos.Pricing.Upsert(context.Background(), models.PricingOverride{
		ID: "po-1", Provider: "selfhosted", Model: "",
		TokenConsumptionRate: &free,
	}); err != nil {
		t.Fatalf("seed provider override: %v", err)
	}

	rates, tokenRate := s.pricingFor(context.Background(), "selfhosted", "my-model")
	if !rates.Zero() {
		t.Fatalf("rates = %+v, want zero (provider row prices nothing)", rates)
	}
	if tokenRate == nil || *tokenRate != 0 {
		t.Fatalf("tokenRate = %v, want explicit 0 (free)", tokenRate)
	}
}
