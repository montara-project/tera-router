package guardrails

import (
	"slices"

	"tera-router/server/internal/models"
)

// Subject is what one inference request touches, used to pick the policy
// layers that apply to it. Empty fields match no policy of that scope.
type Subject struct {
	// KeyID is the authenticated API key's id (key-scope target).
	KeyID string
	// Chain is the routing chain the request resolved through (chain-scope
	// target), "" for direct alias or provider/model calls.
	Chain string
	// Models are the model names the request may reach: the requested model
	// string plus each candidate target's model and provider/model pair.
	Models []string
	// Providers are the provider slugs of every candidate target.
	Providers []string
}

// covers reports whether a policy's scope and target apply to the subject.
func (s Subject) covers(p models.GuardrailPolicy) bool {
	switch p.Scope {
	case "global":
		return true
	case "key":
		return p.Target != "" && p.Target == s.KeyID
	case "chain":
		return p.Target != "" && p.Target == s.Chain
	case "model":
		return p.Target != "" && slices.Contains(s.Models, p.Target)
	case "provider":
		return p.Target != "" && slices.Contains(s.Providers, p.Target)
	default:
		return false
	}
}

// Effective merges the policies that apply to the subject into one detector
// config. policies must be ordered most specific first (ListEnabled order).
func Effective(policies []models.GuardrailPolicy, s Subject) Config {
	applicable := make([]models.GuardrailPolicy, 0, len(policies))
	for _, p := range policies {
		if s.covers(p) {
			applicable = append(applicable, p)
		}
	}
	return Merge(applicable)
}

// Merge folds layered policies into one detector config. policies must be
// ordered most specific first. A detector is active when any layer enables
// it — a narrower layer can tune upstream protection but never switch it off —
// and its settings come from the most specific layer that enables it.
func Merge(policies []models.GuardrailPolicy) Config {
	var cfg Config
	for _, p := range policies {
		layer := ParseConfig(p.Config)
		if layer.Pii.Enabled && !cfg.Pii.Enabled {
			cfg.Pii = layer.Pii
		}
		if layer.Injection.Enabled && !cfg.Injection.Enabled {
			cfg.Injection = layer.Injection
		}
		if layer.Topics.Enabled && !cfg.Topics.Enabled {
			cfg.Topics = layer.Topics
		}
		if layer.Toxicity.Enabled && !cfg.Toxicity.Enabled {
			cfg.Toxicity = layer.Toxicity
		}
		if layer.Bias.Enabled && !cfg.Bias.Enabled {
			cfg.Bias = layer.Bias
		}
	}
	return cfg
}

// Active reports whether any detector in cfg is enabled.
func (cfg Config) Active() bool {
	return cfg.Pii.Enabled || cfg.Injection.Enabled || cfg.Topics.Enabled ||
		cfg.Toxicity.Enabled || cfg.Bias.Enabled
}
