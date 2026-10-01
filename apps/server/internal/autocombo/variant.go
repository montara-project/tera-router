package autocombo

import (
	"strings"
)

// Variant represents an auto-combo routing strategy variant.
type Variant string

const (
	// VariantDefault uses balanced weights across all factors.
	VariantDefault Variant = ""
	// VariantCoding uses quality-first weights for code generation.
	VariantCoding Variant = "coding"
	// VariantFast uses low-latency weighted selection.
	VariantFast Variant = "fast"
	// VariantCheap uses cost-optimized routing.
	VariantCheap Variant = "cheap"
	// VariantOffline favors stability over speed for unreliable upstreams.
	VariantOffline Variant = "offline"
	// VariantSmart uses quality-first selection with a higher exploration rate.
	VariantSmart Variant = "smart"
	// VariantLKGP (last-known-good-path) maximizes stability, minimizing
	// rotation and exploration.
	VariantLKGP Variant = "lkgp"
)

// ParsePrefix parses an "auto" or "auto/<variant>" model string. It returns
// the variant and true when the model is an auto-combo request, or an empty
// variant and false otherwise. An unknown variant falls back to the default
// weights rather than rejecting the request.
func ParsePrefix(model string) (Variant, bool) {
	model = strings.TrimSpace(model)
	if model != "auto" && !strings.HasPrefix(model, "auto/") {
		return "", false
	}

	if model == "auto" {
		return VariantDefault, true
	}

	variant := strings.TrimPrefix(model, "auto/")
	switch Variant(variant) {
	case VariantCoding, VariantFast, VariantCheap, VariantOffline, VariantSmart, VariantLKGP:
		return Variant(variant), true
	default:
		return VariantDefault, true
	}
}

// ChainName is the synthetic chain name an auto-combo request attributes to:
// "auto" for the default variant, "auto/<variant>" otherwise. The gateway
// uses it for access-policy attribution, so an operator can allowlist an
// auto variant like a chain.
func (v Variant) ChainName() string {
	if v == VariantDefault {
		return "auto"
	}
	return "auto/" + string(v)
}
