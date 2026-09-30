package gateway

import (
	"context"
	"testing"
	"time"

	"tera-router/server/internal/core"
	"tera-router/server/internal/models"
)

func TestFilterAllowedTargets(t *testing.T) {
	targets := []target{
		{Provider: "openai", Model: "gpt-4o"},
		{Provider: "openai", Model: "gpt-4o-mini"},
		{Provider: "anthropic", Model: "claude-3-5-sonnet", Alias: "smart"},
		{Provider: "deepseek", Model: "deepseek-chat"},
	}

	cases := []struct {
		name    string
		allowed []string
		want    []string
	}{
		{
			name:    "no restriction allows everything",
			allowed: nil,
			want:    []string{"openai/gpt-4o", "openai/gpt-4o-mini", "anthropic/claude-3-5-sonnet", "deepseek/deepseek-chat"},
		},
		{
			name:    "provider-qualified pattern",
			allowed: []string{"openai/gpt-4o"},
			want:    []string{"openai/gpt-4o"},
		},
		{
			name:    "bare model pattern",
			allowed: []string{"deepseek-chat"},
			want:    []string{"deepseek/deepseek-chat"},
		},
		{
			name:    "alias name pattern",
			allowed: []string{"smart"},
			want:    []string{"anthropic/claude-3-5-sonnet"},
		},
		{
			name:    "wildcard prefix on bare model",
			allowed: []string{"gpt-4o*"},
			want:    []string{"openai/gpt-4o", "openai/gpt-4o-mini"},
		},
		{
			name:    "wildcard on provider-qualified form",
			allowed: []string{"openai/*"},
			want:    []string{"openai/gpt-4o", "openai/gpt-4o-mini"},
		},
		{
			name:    "case insensitive",
			allowed: []string{"OPENAI/GPT-4O"},
			want:    []string{"openai/gpt-4o"},
		},
		{
			name:    "no match yields nothing",
			allowed: []string{"gemini-2.0"},
			want:    nil,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := filterAllowedTargets(models.APIKey{}, targets, "", tc.allowed)
			if len(got) != len(tc.want) {
				t.Fatalf("got %d targets (%v), want %d (%v)", len(got), qualified(got), len(tc.want), tc.want)
			}
			for i := range got {
				if qualified(got)[i] != tc.want[i] {
					t.Errorf("target[%d] = %q, want %q", i, qualified(got)[i], tc.want[i])
				}
			}
		})
	}
}

func TestFilterAllowedTargetsChainGrantsWholeList(t *testing.T) {
	targets := []target{
		{Provider: "openai", Model: "gpt-4o", ChainName: "fast"},
		{Provider: "deepseek", Model: "deepseek-chat", ChainName: "fast"},
	}

	for _, pattern := range []string{"fast", "chain:fast"} {
		got := filterAllowedTargets(models.APIKey{}, targets, "fast", []string{pattern})
		if len(got) != 2 {
			t.Errorf("allowed %q: got %d targets, want both", pattern, len(got))
		}
	}
}

func TestFilterAllowedTargetsChainNotAllowedIsEmpty(t *testing.T) {
	targets := []target{{Provider: "openai", Model: "gpt-4o", ChainName: "fast"}}

	got := filterAllowedTargets(models.APIKey{}, targets, "fast", []string{"openai/gpt-4o"})
	if len(got) != 1 {
		t.Fatalf("got %d targets, want the chain's target kept when it matches", len(got))
	}

	got = filterAllowedTargets(models.APIKey{}, targets, "fast", []string{"something-else"})
	if len(got) != 0 {
		t.Fatalf("got %d targets, want none", len(got))
	}
}

// A key allowlist narrows the plan's: the request only survives where both
// agree, so a key can never reach a model its plan forbids.
func TestNarrowByAllowlistIntersectsKeyAndPlan(t *testing.T) {
	targets := []target{
		{Provider: "openai", Model: "gpt-4o"},
		{Provider: "openai", Model: "gpt-4o-mini"},
		{Provider: "anthropic", Model: "claude-sonnet"},
	}
	plan := &models.Plan{Name: "Pro", AllowedModels: []string{"gpt-4o", "claude-sonnet"}}

	cases := []struct {
		name      string
		keyModels []string
		want      []string
		wantLayer string
	}{
		{
			name:      "key allowlist narrower than plan",
			keyModels: []string{"gpt-4o"},
			want:      []string{"openai/gpt-4o"},
		},
		{
			name:      "key allowlist wider than plan still intersects",
			keyModels: []string{"gpt-4o", "gpt-4o-mini"},
			want:      []string{"openai/gpt-4o"},
		},
		{
			name:      "no key allowlist defers to plan",
			keyModels: nil,
			want:      []string{"openai/gpt-4o", "anthropic/claude-sonnet"},
		},
		{
			name:      "key allowlist matching no target is denied at the key layer",
			keyModels: []string{"gemini-*"},
			wantLayer: "key",
		},
		{
			name:      "key allowlist surviving its layer but not the plan is denied at the plan layer",
			keyModels: []string{"gpt-4o-mini"},
			wantLayer: "plan",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			key := models.APIKey{AllowedModels: tc.keyModels}
			got, layer := narrowByAllowlist(key, targets, "", plan)

			if layer != tc.wantLayer {
				t.Fatalf("layer = %q, want %q", layer, tc.wantLayer)
			}
			if len(got) != len(tc.want) {
				t.Fatalf("got %d targets (%v), want %d (%v)",
					len(got), qualified(got), len(tc.want), tc.want)
			}
			for i := range got {
				if qualified(got)[i] != tc.want[i] {
					t.Errorf("target[%d] = %q, want %q", i, qualified(got)[i], tc.want[i])
				}
			}
		})
	}
}

// Without a plan, only the key allowlist applies.
func TestNarrowByAllowlistWithoutPlan(t *testing.T) {
	targets := []target{
		{Provider: "openai", Model: "gpt-4o"},
		{Provider: "deepseek", Model: "deepseek-chat"},
	}

	got, layer := narrowByAllowlist(models.APIKey{AllowedModels: []string{"deepseek-*"}}, targets, "", nil)
	if layer != "" {
		t.Fatalf("layer = %q, want no rejection", layer)
	}
	if len(got) != 1 || qualified(got)[0] != "deepseek/deepseek-chat" {
		t.Fatalf("got %v, want only the deepseek target", qualified(got))
	}

	got, layer = narrowByAllowlist(models.APIKey{AllowedModels: []string{"gemini-*"}}, targets, "", nil)
	if layer != "key" || len(got) != 0 {
		t.Fatalf("got (%v, %q), want none denied at the key layer", qualified(got), layer)
	}
}

func TestTargetMatchesAny(t *testing.T) {
	tgt := target{Provider: "anthropic", Model: "claude-3-5-sonnet", Alias: "smart"}

	cases := []struct {
		pattern string
		want    bool
	}{
		{"anthropic/claude-3-5-sonnet", true},
		{"claude-3-5-sonnet", true},
		{"smart", true},
		{"claude-*", true},
		{"anthropic/*", true},
		{"openai/claude-3-5-sonnet", false},
		{"claude", false},
		{"", false},
	}
	for _, tc := range cases {
		if got := targetMatchesAny(tgt, []string{tc.pattern}); got != tc.want {
			t.Errorf("targetMatchesAny(%q) = %v, want %v", tc.pattern, got, tc.want)
		}
	}
}

func TestBudgetAppliesTo(t *testing.T) {
	cases := []struct {
		name   string
		budget models.Budget
		keyID  string
		want   bool
	}{
		{"api_key scope for this key", models.Budget{ScopeKind: models.ScopeAPIKey, ScopeID: "k1"}, "k1", true},
		{"api_key scope for another key", models.Budget{ScopeKind: models.ScopeAPIKey, ScopeID: "k2"}, "k1", false},
		{"tenant scope is global", models.Budget{ScopeKind: models.ScopeTenant, ScopeID: "t1"}, "k1", true},
		{"account scope is not enforced here", models.Budget{ScopeKind: models.ScopeAccount, ScopeID: "a1"}, "k1", false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := budgetAppliesTo(tc.budget, tc.keyID); got != tc.want {
				t.Errorf("budgetAppliesTo = %v, want %v", got, tc.want)
			}
		})
	}
}

func TestBudgetExceeded(t *testing.T) {
	cases := []struct {
		name   string
		budget models.Budget
		spent  usageTotals
		want   bool
	}{
		{"under both limits", models.Budget{LimitMicros: 1000, LimitTokens: 100}, usageTotals{Micros: 500, Tokens: 50}, false},
		{"spend exactly at limit", models.Budget{LimitMicros: 1000}, usageTotals{Micros: 1000}, true},
		{"spend over limit", models.Budget{LimitMicros: 1000}, usageTotals{Micros: 1001}, true},
		{"tokens exactly at limit", models.Budget{LimitTokens: 100}, usageTotals{Tokens: 100}, true},
		{"zero limits never block", models.Budget{}, usageTotals{Micros: 1 << 40, Tokens: 1 << 40}, false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, _ := budgetExceeded(tc.budget, tc.spent)
			if got != tc.want {
				t.Errorf("budgetExceeded = %v, want %v", got, tc.want)
			}
		})
	}
}

func TestPlanExceeded(t *testing.T) {
	plan := models.Plan{Name: "pro", LimitMicros: 5_000_000}
	if blocked, _ := planExceeded(plan, usageTotals{Micros: 4_999_999}); blocked {
		t.Error("under the cap must not block")
	}
	blocked, reason := planExceeded(plan, usageTotals{Micros: 5_000_000})
	if !blocked {
		t.Error("at the cap must block")
	}
	if reason == "" {
		t.Error("a block must carry a reason")
	}
}

func TestCheckBudgets(t *testing.T) {
	s, a := newTestServer(t)
	key := models.APIKey{ID: "key-1", Name: "test"}

	// Under the cap: allowed.
	exec(t, a, `INSERT INTO budgets (id, scope_kind, scope_id, limit_micros, period, hard_cutoff)
		VALUES ('b1', 'api_key', 'key-1', 1000000, 'monthly', true)`)
	if err := s.checkBudgets(context.Background(), key, nil); err != nil {
		t.Fatalf("under budget should pass: %v", err)
	}

	// Record spend past the cap.
	exec(t, a, `INSERT INTO usage_records (api_key_id, provider, model, cost_micros, created_at)
		VALUES ('key-1', 'openai', 'gpt-4o', 1000000, ?)`, time.Now().UTC())

	err := s.checkBudgets(context.Background(), key, nil)
	if err == nil {
		t.Fatal("expected the budget to block")
	}
	if pe := core.AsProviderError(err); pe.Kind != core.ErrBudgetBlocked {
		t.Errorf("kind = %q, want budget_blocked", pe.Kind)
	}

	// A budget without hard_cutoff is advisory only.
	exec(t, a, `UPDATE budgets SET hard_cutoff = false WHERE id = 'b1'`)
	if err := s.checkBudgets(context.Background(), key, nil); err != nil {
		t.Errorf("soft budget must not block: %v", err)
	}
}

func TestCheckBudgetsIgnoresOtherKeysSpend(t *testing.T) {
	s, a := newTestServer(t)
	key := models.APIKey{ID: "key-1"}

	exec(t, a, `INSERT INTO budgets (id, scope_kind, scope_id, limit_micros, period, hard_cutoff)
		VALUES ('b2', 'api_key', 'key-1', 1000000, 'monthly', true)`)
	// Spend attributed to a different key must not count against this one.
	exec(t, a, `INSERT INTO usage_records (api_key_id, provider, model, cost_micros, created_at)
		VALUES ('other-key', 'openai', 'gpt-4o', 99999999, ?)`, time.Now().UTC())

	if err := s.checkBudgets(context.Background(), key, nil); err != nil {
		t.Errorf("another key's spend must not block this one: %v", err)
	}
}

func TestCheckBudgetsTenantScopeCountsEveryKey(t *testing.T) {
	s, a := newTestServer(t)
	key := models.APIKey{ID: "key-1"}

	exec(t, a, `INSERT INTO budgets (id, scope_kind, scope_id, limit_tokens, period, hard_cutoff)
		VALUES ('b3', 'tenant', 'default', 100, 'monthly', true)`)
	exec(t, a, `INSERT INTO usage_records (api_key_id, provider, model, prompt_tokens, completion_tokens, created_at)
		VALUES ('some-other-key', 'openai', 'gpt-4o', 60, 60, ?)`, time.Now().UTC())

	err := s.checkBudgets(context.Background(), key, nil)
	if err == nil {
		t.Fatal("tenant-scoped budget must count every key's tokens")
	}
}

func TestCheckBudgetsPlanLimits(t *testing.T) {
	s, a := newTestServer(t)
	key := models.APIKey{ID: "key-1"}

	exec(t, a, `INSERT INTO usage_records (api_key_id, provider, model, cost_micros, created_at)
		VALUES ('key-1', 'openai', 'gpt-4o', 2000000, ?)`, time.Now().UTC())

	plan := &models.Plan{Name: "pro", LimitMicros: 1_000_000, HardCutoff: true, Period: "monthly"}
	err := s.checkBudgets(context.Background(), key, plan)
	if err == nil {
		t.Fatal("plan cap must block")
	}

	// Without hard_cutoff the plan is advisory.
	softPlan := &models.Plan{Name: "pro", LimitMicros: 1_000_000, HardCutoff: false, Period: "monthly"}
	if err := s.checkBudgets(context.Background(), key, softPlan); err != nil {
		t.Errorf("soft plan must not block: %v", err)
	}
}

func TestPeriodStartExcludesOlderSpend(t *testing.T) {
	s, a := newTestServer(t)
	key := models.APIKey{ID: "key-1"}

	exec(t, a, `INSERT INTO budgets (id, scope_kind, scope_id, limit_micros, period, hard_cutoff)
		VALUES ('b4', 'api_key', 'key-1', 1000, 'daily', true)`)
	// Two days ago: outside the daily window.
	old := time.Now().UTC().Add(-48 * time.Hour)
	exec(t, a, `INSERT INTO usage_records (api_key_id, provider, model, cost_micros, created_at)
		VALUES ('key-1', 'openai', 'gpt-4o', 999999, ?)`, old)

	if err := s.checkBudgets(context.Background(), key, nil); err != nil {
		t.Errorf("spend outside the period window must not block: %v", err)
	}
}

// qualified renders targets as provider/model for comparison.
func qualified(targets []target) []string {
	out := make([]string, len(targets))
	for i, t := range targets {
		out[i] = t.Provider + "/" + t.Model
	}
	return out
}
