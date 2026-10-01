package gateway

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"testing"

	"tera-router/server/internal/app"
	"tera-router/server/internal/config"
	"tera-router/server/internal/database"
	"tera-router/server/internal/lib/sealer"
	"tera-router/server/internal/migrator"
	"tera-router/server/internal/repositories"
	"tera-router/server/internal/services"
)

// newTestServer builds a Server over a freshly migrated temporary SQLite
// database. Resolution, access policy, and planning all read real rows, so the
// tests exercise the SQL rather than a stub.
func newTestServer(t *testing.T) (*Server, *app.Application) {
	t.Helper()

	db, err := database.Open(filepath.Join(t.TempDir(), "gateway_test.db"))
	if err != nil {
		t.Fatalf("open database: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })

	if err := migrator.Up(db, "../../migrations"); err != nil {
		t.Fatalf("migrate: %v", err)
	}

	cfg := config.Config{App: config.ConfigApp{Env: config.EnvDevelopment, Secret: "test-secret"}}
	secrets, err := sealer.FromSecret(cfg.App.Secret)
	if err != nil {
		t.Fatalf("sealer: %v", err)
	}

	application := &app.Application{
		Config:   cfg,
		Logger:   slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: slog.LevelError})),
		DB:       db,
		Repos:    repositories.New(db, &cfg.App),
		Secrets:  secrets,
		Services: services.New(),
	}
	srv := New(application)
	// Metering writes run asynchronously; wait for them before the test's
	// temporary directory is removed, or the cleanup races the write.
	t.Cleanup(srv.Drain)
	return srv, application
}

// exec runs a raw statement against the test database.
func exec(t *testing.T, a *app.Application, query string, args ...any) {
	t.Helper()
	if _, err := a.DB.ExecContext(context.Background(), query, args...); err != nil {
		t.Fatalf("exec %q: %v", query, err)
	}
}

func TestResolveTargetsProviderModel(t *testing.T) {
	s, _ := newTestServer(t)

	res, err := s.resolveTargets(context.Background(), "openai/gpt-4o")
	if err != nil {
		t.Fatalf("resolve: %v", err)
	}
	if len(res.Targets) != 1 {
		t.Fatalf("targets = %d, want 1", len(res.Targets))
	}
	if got := res.Targets[0].Provider; got != "openai" {
		t.Errorf("provider = %q, want openai", got)
	}
	if got := res.Targets[0].Model; got != "gpt-4o" {
		t.Errorf("model = %q, want gpt-4o", got)
	}
	if res.Targets[0].Alias != "" {
		t.Errorf("alias = %q, want empty for a direct provider/model", res.Targets[0].Alias)
	}
	if res.EchoModel != "openai/gpt-4o" {
		t.Errorf("echo = %q, want the requested id", res.EchoModel)
	}
}

func TestResolveTargetsKeepsSlashesInModel(t *testing.T) {
	s, _ := newTestServer(t)

	// Only the first slash splits provider from model, so a vendor-namespaced
	// id survives intact.
	res, err := s.resolveTargets(context.Background(), "openrouter/anthropic/claude-3.5")
	if err != nil {
		t.Fatalf("resolve: %v", err)
	}
	if got := res.Targets[0].Model; got != "anthropic/claude-3.5" {
		t.Errorf("model = %q, want anthropic/claude-3.5", got)
	}
}

func TestResolveTargetsUnknownProvider(t *testing.T) {
	s, _ := newTestServer(t)

	_, err := s.resolveTargets(context.Background(), "not-a-provider/some-model")
	if err == nil {
		t.Fatal("expected an error for an unknown provider")
	}
	var bad badModelError
	if !asBadModel(err, &bad) {
		t.Fatalf("error %T = %v, want badModelError", err, err)
	}
	if bad.Error() != "unknown provider: not-a-provider" {
		t.Errorf("message = %q", bad.Error())
	}
}

func TestResolveTargetsUnknownBareModel(t *testing.T) {
	s, _ := newTestServer(t)

	_, err := s.resolveTargets(context.Background(), "definitely-not-a-model")
	var bad badModelError
	if !asBadModel(err, &bad) {
		t.Fatalf("error = %v, want badModelError", err)
	}
	if bad.Error() != "unknown model: definitely-not-a-model" {
		t.Errorf("message = %q", bad.Error())
	}
}

func TestResolveTargetsChain(t *testing.T) {
	s, a := newTestServer(t)
	seedChain(t, a, "fast", "priority", []chainStep{
		{provider: "openai", model: "gpt-4o-mini"},
		{provider: "anthropic", model: "claude-3-5-sonnet"},
	}, "", "")

	res, err := s.resolveTargets(context.Background(), "chain:fast")
	if err != nil {
		t.Fatalf("resolve: %v", err)
	}
	if len(res.Targets) != 2 {
		t.Fatalf("targets = %d, want 2", len(res.Targets))
	}
	if res.Targets[0].Provider != "openai" || res.Targets[0].Model != "gpt-4o-mini" {
		t.Errorf("target[0] = %+v", res.Targets[0])
	}
	if res.ChainName != "fast" {
		t.Errorf("chain name = %q, want fast", res.ChainName)
	}
	if res.EchoModel != "chain:fast" {
		t.Errorf("echo = %q, want chain:fast", res.EchoModel)
	}
	if res.Targets[0].ChainName != "fast" {
		t.Errorf("target chain = %q, want fast", res.Targets[0].ChainName)
	}
}

func TestResolveTargetsBareChainName(t *testing.T) {
	s, a := newTestServer(t)
	seedChain(t, a, "cheap", "priority", []chainStep{{provider: "deepseek", model: "deepseek-chat"}}, "", "")

	res, err := s.resolveTargets(context.Background(), "cheap")
	if err != nil {
		t.Fatalf("resolve: %v", err)
	}
	if len(res.Targets) != 1 || res.Targets[0].Provider != "deepseek" {
		t.Fatalf("targets = %+v", res.Targets)
	}
}

func TestResolveTargetsChainFallbackAppended(t *testing.T) {
	s, a := newTestServer(t)
	seedChain(t, a, "primary", "priority",
		[]chainStep{{provider: "openai", model: "gpt-4o"}},
		"deepseek", "deepseek-chat")

	res, err := s.resolveTargets(context.Background(), "chain:primary")
	if err != nil {
		t.Fatalf("resolve: %v", err)
	}
	if len(res.Targets) != 2 {
		t.Fatalf("targets = %d, want 2 (step + fallback)", len(res.Targets))
	}
	if res.Targets[1].Provider != "deepseek" || res.Targets[1].Model != "deepseek-chat" {
		t.Errorf("fallback target = %+v", res.Targets[1])
	}
}

func TestResolveTargetsDisabledChain(t *testing.T) {
	s, a := newTestServer(t)
	seedChain(t, a, "off", "priority", []chainStep{{provider: "openai", model: "gpt-4o"}}, "", "")
	exec(t, a, `UPDATE chains SET enabled = false WHERE name = 'off'`)

	_, err := s.resolveTargets(context.Background(), "chain:off")
	var bad badModelError
	if !asBadModel(err, &bad) {
		t.Fatalf("error = %v, want badModelError", err)
	}
}

func TestResolveTargetsAliasOrdersByPositionAndSkipsInactive(t *testing.T) {
	s, a := newTestServer(t)
	seedAlias(t, a, "smart", []aliasTarget{
		{provider: "openai", model: "gpt-4o", position: 2, active: true},
		{provider: "anthropic", model: "claude-3-5-sonnet", position: 1, active: true},
		{provider: "deepseek", model: "deepseek-chat", position: 3, active: false},
	})

	res, err := s.resolveTargets(context.Background(), "smart")
	if err != nil {
		t.Fatalf("resolve: %v", err)
	}
	if len(res.Targets) != 2 {
		t.Fatalf("targets = %d, want 2 (inactive dropped)", len(res.Targets))
	}
	if res.Targets[0].Provider != "anthropic" {
		t.Errorf("target[0] = %+v, want the position-1 target first", res.Targets[0])
	}
	if res.Targets[0].Alias != "smart" {
		t.Errorf("alias = %q, want smart", res.Targets[0].Alias)
	}
	if res.EchoModel != "smart" {
		t.Errorf("echo = %q, want smart", res.EchoModel)
	}
}

func TestResolveTargetsAliasWinsOverProviderModel(t *testing.T) {
	s, a := newTestServer(t)
	// An alias literally named "openai/gpt-4o" must resolve as the alias, not
	// as a provider/model pair.
	seedAlias(t, a, "openai/gpt-4o", []aliasTarget{
		{provider: "deepseek", model: "deepseek-chat", position: 1, active: true},
	})

	res, err := s.resolveTargets(context.Background(), "openai/gpt-4o")
	if err != nil {
		t.Fatalf("resolve: %v", err)
	}
	if res.Targets[0].Provider != "deepseek" {
		t.Errorf("provider = %q, want deepseek (alias wins)", res.Targets[0].Provider)
	}
	if res.EchoModel != "openai/gpt-4o" {
		t.Errorf("echo = %q", res.EchoModel)
	}
}

func TestResolveTargetsInactiveAliasFallsThroughToProviderModel(t *testing.T) {
	s, a := newTestServer(t)
	seedAlias(t, a, "openai/gpt-4o", []aliasTarget{
		{provider: "deepseek", model: "deepseek-chat", position: 1, active: true},
	})
	exec(t, a, `UPDATE model_aliases SET active = false WHERE name = 'openai/gpt-4o'`)

	res, err := s.resolveTargets(context.Background(), "openai/gpt-4o")
	if err != nil {
		t.Fatalf("resolve: %v", err)
	}
	if res.Targets[0].Provider != "openai" || res.Targets[0].Model != "gpt-4o" {
		t.Errorf("targets = %+v, want the provider/model interpretation", res.Targets)
	}
}

func TestResolveTargetsRoundRobinRotates(t *testing.T) {
	s, a := newTestServer(t)
	seedChain(t, a, "rr", "round-robin", []chainStep{
		{provider: "openai", model: "a"},
		{provider: "openai", model: "b"},
		{provider: "openai", model: "c"},
	}, "", "")

	seen := map[string]int{}
	for range 3 {
		res, err := s.resolveTargets(context.Background(), "chain:rr")
		if err != nil {
			t.Fatalf("resolve: %v", err)
		}
		if res.Strategy != strategyRoundRobin {
			t.Fatalf("strategy = %q, want %q", res.Strategy, strategyRoundRobin)
		}
		seen[res.Targets[0].Model]++
	}
	// Three requests over three targets must start each target exactly once.
	for _, model := range []string{"a", "b", "c"} {
		if seen[model] != 1 {
			t.Errorf("model %q started %d times, want 1: %v", model, seen[model], seen)
		}
	}
}

func TestResolveTargetsCustomProvider(t *testing.T) {
	s, a := newTestServer(t)
	exec(t, a, `INSERT INTO custom_providers (id, name, slug, base_url, api_kind, enabled)
		VALUES ('cp1', 'Local vLLM', 'my-vllm', 'http://localhost:8000/v1', 'openai', true)`)

	res, err := s.resolveTargets(context.Background(), "my-vllm/llama-3")
	if err != nil {
		t.Fatalf("resolve: %v", err)
	}
	if res.Targets[0].Provider != "my-vllm" {
		t.Errorf("provider = %q", res.Targets[0].Provider)
	}
}

func TestResolveTargetsDisabledCustomProviderIsUnknown(t *testing.T) {
	s, a := newTestServer(t)
	exec(t, a, `INSERT INTO custom_providers (id, name, slug, base_url, api_kind, enabled)
		VALUES ('cp2', 'Off', 'off-provider', 'http://localhost:1', 'openai', false)`)

	_, err := s.resolveTargets(context.Background(), "off-provider/model")
	var bad badModelError
	if !asBadModel(err, &bad) {
		t.Fatalf("error = %v, want badModelError", err)
	}
}

func TestResolveTargetsEmptyModel(t *testing.T) {
	s, _ := newTestServer(t)

	_, err := s.resolveTargets(context.Background(), "   ")
	var bad badModelError
	if !asBadModel(err, &bad) {
		t.Fatalf("error = %v, want badModelError", err)
	}
	if bad.Error() != "model is required" {
		t.Errorf("message = %q", bad.Error())
	}
}

func TestNormalizeStrategy(t *testing.T) {
	cases := map[string]string{
		"round-robin":   strategyRoundRobin,
		"round_robin":   strategyRoundRobin,
		"RoundRobin":    strategyRoundRobin,
		"ROUNDROBIN":    strategyRoundRobin,
		"load-balanced": strategyLoadBal,
		"load_balanced": strategyLoadBal,
		"priority":      strategyPriority,
		"":              strategyPriority,
		"nonsense":      strategyPriority,
	}
	for in, want := range cases {
		if got := normalizeStrategy(in); got != want {
			t.Errorf("normalizeStrategy(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestProviderSpecDialects(t *testing.T) {
	s, a := newTestServer(t)

	cases := []struct {
		slug         string
		wantDialect  string
		wantRoutable bool
	}{
		{"openai", "openai", true},
		{"anthropic", "anthropic", true},
		{"cline", "openai", true},
		{"cloudflare", "openai", true},
	}
	for _, tc := range cases {
		spec, ok := s.providerSpec(context.Background(), tc.slug)
		if !ok {
			t.Errorf("providerSpec(%q) not found", tc.slug)
			continue
		}
		if string(spec.Dialect) != tc.wantDialect {
			t.Errorf("providerSpec(%q).Dialect = %q, want %q", tc.slug, spec.Dialect, tc.wantDialect)
		}
		if routable := spec.Dialect != ""; routable != tc.wantRoutable {
			t.Errorf("providerSpec(%q) routable = %v, want %v", tc.slug, routable, tc.wantRoutable)
		}
	}

	// Custom providers map api_kind onto a dialect.
	for _, tc := range []struct {
		apiKind string
		want    string
	}{
		{"anthropic", "anthropic"},
		{"openai_responses", "openai_responses"},
		{"responses", "openai_responses"},
		{"openai", "openai"},
		{"", "openai"},
	} {
		slug := "custom-" + tc.apiKind
		exec(t, a, `INSERT INTO custom_providers (id, name, slug, base_url, api_kind, enabled)
			VALUES (?, ?, ?, 'http://localhost:9/v1', ?, true)`, slug, slug, slug, tc.apiKind)
		spec, ok := s.providerSpec(context.Background(), slug)
		if !ok {
			t.Errorf("providerSpec(%q) not found", slug)
			continue
		}
		if string(spec.Dialect) != tc.want {
			t.Errorf("api_kind %q -> dialect %q, want %q", tc.apiKind, spec.Dialect, tc.want)
		}
	}
}

// --- helpers ---

func asBadModel(err error, target *badModelError) bool {
	bad, ok := err.(badModelError)
	if ok {
		*target = bad
	}
	return ok
}

type chainStep struct{ provider, model string }

func seedChain(t *testing.T, a *app.Application, name, strategy string, steps []chainStep, fbProvider, fbModel string) {
	t.Helper()
	exec(t, a, `INSERT INTO chains (id, name, strategy, fallback_provider, fallback_model, enabled)
		VALUES (?, ?, ?, ?, ?, true)`, "chain-"+name, name, strategy, fbProvider, fbModel)
	for i, step := range steps {
		// The id includes the position so a chain may legitimately list the
		// same model on two different providers.
		exec(t, a, `INSERT INTO chain_steps (id, chain_id, position, provider, model)
			VALUES (?, ?, ?, ?, ?)`,
			fmt.Sprintf("step-%s-%d", name, i), "chain-"+name, i+1, step.provider, step.model)
	}
}

type aliasTarget struct {
	provider, model string
	position        int
	active          bool
}

func seedAlias(t *testing.T, a *app.Application, name string, targets []aliasTarget) {
	t.Helper()
	exec(t, a, `INSERT INTO model_aliases (id, name, active) VALUES (?, ?, true)`, "alias-"+name, name)
	for _, tgt := range targets {
		exec(t, a, `INSERT INTO alias_targets (id, alias_id, position, provider, model, active)
			VALUES (?, ?, ?, ?, ?, ?)`,
			"at-"+name+"-"+tgt.model, "alias-"+name, tgt.position, tgt.provider, tgt.model, tgt.active)
	}
}
