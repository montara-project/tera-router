package gateway

import (
	"context"
	"errors"
	"strings"
	"time"

	"tera-router/server/internal/core"
	"tera-router/server/internal/lib/apperr"
	"tera-router/server/internal/lib/period"
	"tera-router/server/internal/models"
)

// filterAllowedTargets applies the API key's plan-level model restriction.
//
// A key whose plan lists allowed models may only reach targets matching one of
// the patterns; everything else is dropped. Patterns match, case-insensitively,
// against any of:
//
//   - the provider-qualified target ("openai/gpt-4o"),
//   - the bare upstream model ("gpt-4o"),
//   - the alias the request resolved through ("fast"),
//   - the chain the request resolved through, as "chain:<name>" or bare name.
//
// A trailing "*" is a prefix wildcard ("claude-*"). An empty allowed list means
// no restriction. A chain that is itself allowed grants its whole target list,
// because the upstream ids inside a chain never equal the chain's name.
func filterAllowedTargets(key models.APIKey, targets []target, chainName string, allowed []string) []target {
	if len(allowed) == 0 {
		return targets
	}

	// A chain-resolved request grants its whole target list when the chain
	// itself is allowed (by "chain:name" or bare name).
	if chainName != "" {
		for _, a := range allowed {
			p := strings.ToLower(strings.TrimSpace(a))
			if p == strings.ToLower("chain:"+chainName) || p == strings.ToLower(chainName) {
				return targets
			}
		}
	}

	out := make([]target, 0, len(targets))
	for _, t := range targets {
		if targetMatchesAny(t, allowed) {
			out = append(out, t)
		}
	}
	return out
}

// narrowByAllowlist applies the key's own model allowlist and then its plan's,
// returning the surviving targets and, when nothing survives, the layer that
// rejected the request ("key" or "plan").
//
// A key allowlist only ever restricts: a key can never reach a model its plan
// forbids, so the two layers compose to their intersection. Either layer being
// empty means "no restriction at that layer".
func narrowByAllowlist(key models.APIKey, targets []target, chainName string, plan *models.Plan) ([]target, string) {
	if len(key.AllowedModels) > 0 {
		targets = filterAllowedTargets(key, targets, chainName, key.AllowedModels)
		if len(targets) == 0 {
			return nil, "key"
		}
	}

	if plan != nil && len(plan.AllowedModels) > 0 {
		targets = filterAllowedTargets(key, targets, chainName, plan.AllowedModels)
		if len(targets) == 0 {
			return nil, "plan"
		}
	}

	return targets, ""
}

// planName is the plan's name for log fields, or "" when the key has no plan.
func planName(plan *models.Plan) string {
	if plan == nil {
		return ""
	}
	return plan.Name
}

// targetMatchesAny reports whether a target satisfies any allowed pattern.
func targetMatchesAny(t target, allowed []string) bool {
	bare := strings.ToLower(t.Model)
	qualified := strings.ToLower(t.Provider + "/" + t.Model)
	alias := strings.ToLower(t.Alias)

	for _, pattern := range allowed {
		p := strings.ToLower(strings.TrimSpace(pattern))
		if p == "" {
			continue
		}
		if prefix, wildcard := strings.CutSuffix(p, "*"); wildcard {
			if strings.HasPrefix(bare, prefix) ||
				strings.HasPrefix(qualified, prefix) ||
				(alias != "" && strings.HasPrefix(alias, prefix)) {
				return true
			}
			continue
		}
		if p == bare || p == qualified {
			return true
		}
		if alias != "" && p == alias {
			return true
		}
	}
	return false
}

// planForKey loads the plan bound to a key, or (nil, nil) when the key has no
// plan or the plan is gone.
func (s *Server) planForKey(ctx context.Context, key models.APIKey) (*models.Plan, error) {
	if key.PlanID == nil || *key.PlanID == "" {
		return nil, nil
	}
	plan, err := s.app.Repos.Plans.Get(ctx, *key.PlanID)
	if err != nil {
		if errors.Is(err, apperr.ErrNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &plan, nil
}

// checkBudgets enforces spend/token limits before dispatch. It inspects
// hard-cutoff budgets scoped to this API key or the tenant as a whole, plus the
// key's plan limits, computing current-period spend from usage_records.
//
// A block is returned as a *core.ProviderError with Kind ErrBudgetBlocked, which
// the caller maps to HTTP 402. Budgets without hard_cutoff never block — they
// are advisory (the dashboard surfaces them as alerts).
func (s *Server) checkBudgets(ctx context.Context, key models.APIKey, plan *models.Plan) error {
	budgets, err := s.app.Repos.Budgets.List(ctx)
	if err != nil {
		return err
	}

	now := time.Now()
	for _, b := range budgets {
		if !b.HardCutoff {
			continue
		}
		if !budgetAppliesTo(b, key.ID) {
			continue
		}
		from := periodStart(b.Period, now)
		spend, err := s.usageSince(ctx, b.ScopeKind, b.ScopeID, from)
		if err != nil {
			return err
		}
		if blocked, reason := budgetExceeded(b, spend); blocked {
			return &core.ProviderError{Kind: core.ErrBudgetBlocked, Message: reason}
		}
	}

	if plan != nil && plan.HardCutoff {
		from := periodStart(plan.Period, now)
		spend, err := s.usageSince(ctx, models.ScopeAPIKey, key.ID, from)
		if err != nil {
			return err
		}
		if blocked, reason := planExceeded(*plan, spend); blocked {
			return &core.ProviderError{Kind: core.ErrBudgetBlocked, Message: reason}
		}
	}

	return nil
}

// budgetAppliesTo reports whether a budget governs this request. Only the
// api_key scope (matching this key) and the tenant scope (global) are enforced
// at the gateway; account-scoped budgets are upstream-quota bookkeeping.
func budgetAppliesTo(b models.Budget, keyID string) bool {
	switch b.ScopeKind {
	case models.ScopeAPIKey:
		return b.ScopeID == keyID
	case models.ScopeTenant:
		return true
	default:
		return false
	}
}

// usageSince reads current-period spend and tokens for a budget scope. The
// api_key scope is narrowed to the key; the tenant scope counts every key.
func (s *Server) usageSince(ctx context.Context, kind models.BudgetScope, scopeID string, from time.Time) (usageTotals, error) {
	var keyFilter *string
	if kind == models.ScopeAPIKey {
		id := scopeID
		keyFilter = &id
	}
	spend, err := s.app.Repos.Usage.SumSince(ctx, keyFilter, from)
	if err != nil {
		return usageTotals{}, err
	}
	return usageTotals{
		Micros: spend.CostMicros,
		Tokens: spend.PromptTokens + spend.CompletionTokens,
	}, nil
}

// usageTotals is the spend/token pair a limit is compared against.
type usageTotals struct {
	Micros int64
	Tokens int64
}

// budgetExceeded reports whether a hard-cutoff budget is exhausted.
func budgetExceeded(b models.Budget, spent usageTotals) (bool, string) {
	if b.LimitMicros > 0 && spent.Micros >= b.LimitMicros {
		return true, "budget exhausted: spend limit reached for " + string(b.ScopeKind) + " " + b.ScopeID
	}
	if b.LimitTokens > 0 && spent.Tokens >= b.LimitTokens {
		return true, "budget exhausted: token limit reached for " + string(b.ScopeKind) + " " + b.ScopeID
	}
	return false, ""
}

// planExceeded reports whether a hard-cutoff plan is exhausted.
func planExceeded(p models.Plan, spent usageTotals) (bool, string) {
	if p.LimitMicros > 0 && spent.Micros >= p.LimitMicros {
		return true, "plan limit reached: spend cap exceeded for plan " + p.Name
	}
	if p.LimitTokens > 0 && spent.Tokens >= p.LimitTokens {
		return true, "plan limit reached: token cap exceeded for plan " + p.Name
	}
	return false, ""
}

// periodStart resolves the start of the current period window. An unknown or
// empty period is treated as monthly, matching the dashboard.
func periodStart(p string, now time.Time) time.Time {
	_, from := period.Window(p, now)
	return from
}
