package handlers

import (
	"testing"

	"tera-router/server/internal/dtos"
	"tera-router/server/internal/models"
)

func TestApplyChainPatchClearsFallback(t *testing.T) {
	stored := func() models.Chain {
		return models.Chain{Name: "c", FallbackProvider: "openai", FallbackModel: "gpt-x", ContextWindow: 8000}
	}
	empty, zero := "", 0

	chain := stored()
	applyChainPatch(&chain, dtos.Chain{FallbackProvider: &empty, FallbackModel: &empty, ContextWindow: &zero})
	if chain.FallbackProvider != "" || chain.FallbackModel != "" || chain.ContextWindow != 0 {
		t.Errorf("explicit empty values not applied: %+v", chain)
	}

	chain = stored()
	applyChainPatch(&chain, dtos.Chain{})
	if chain.FallbackModel != "gpt-x" || chain.FallbackProvider != "openai" || chain.ContextWindow != 8000 {
		t.Errorf("omitted fields changed the chain: %+v", chain)
	}
}
