package autocombo

import (
	"context"
	"errors"
	"testing"
	"time"
)

type stubAccounts struct {
	accs []AccountRef
	err  error
}

func (s stubAccounts) ListAll(context.Context) ([]AccountRef, error) {
	return s.accs, s.err
}

type stubStats struct {
	pairs []PairStats
	err   error
}

func (s stubStats) ModelStats(context.Context, time.Time) ([]PairStats, error) {
	return s.pairs, s.err
}

type stubCatalog struct {
	// active maps provider -> set of catalog-active model ids. A provider
	// missing from the map has no stored catalog, so its pairs are ungated.
	active map[string]map[string]bool
	err    error
}

func (s stubCatalog) ActiveModels(_ context.Context, provider string) (map[string]bool, bool, error) {
	if s.err != nil {
		return nil, false, s.err
	}
	active, ok := s.active[provider]
	return active, ok, nil
}

func TestParsePrefix(t *testing.T) {
	cases := []struct {
		model   string
		variant Variant
		ok      bool
	}{
		{"auto", VariantDefault, true},
		{"  auto  ", VariantDefault, true},
		{"auto/fast", VariantFast, true},
		{"auto/coding", VariantCoding, true},
		{"auto/lkgp", VariantLKGP, true},
		{"auto/nope", VariantDefault, true}, // unknown variant falls back
		{"automation", "", false},
		{"auto/gpt-4o", VariantDefault, true}, // "auto/" prefix wins over provider/model
		{"openai/gpt-4o", "", false},
		{"", "", false},
	}
	for _, tc := range cases {
		variant, ok := ParsePrefix(tc.model)
		if ok != tc.ok || variant != tc.variant {
			t.Errorf("ParsePrefix(%q) = (%q, %v), want (%q, %v)", tc.model, variant, ok, tc.variant, tc.ok)
		}
	}
}

func TestChainName(t *testing.T) {
	if got := VariantDefault.ChainName(); got != "auto" {
		t.Errorf("default chain name = %q, want auto", got)
	}
	if got := VariantFast.ChainName(); got != "auto/fast" {
		t.Errorf("fast chain name = %q, want auto/fast", got)
	}
}

func TestBuildOrdersByScore(t *testing.T) {
	e := NewEngine(
		stubAccounts{accs: []AccountRef{
			{Provider: "zeta"}, // unsorted input: build output must still be score-ordered
			{Provider: "alpha"},
		}},
		stubStats{pairs: []PairStats{
			{Provider: "alpha", Model: "a1", Requests: 100, Failures: 0, AvgLatencyMS: 200},
			{Provider: "zeta", Model: "z1", Requests: 100, Failures: 50, AvgLatencyMS: 2000},
		}},
		nil,
	)
	e.DisableExploration()

	targets, err := e.Build(context.Background(), VariantDefault)
	if err != nil {
		t.Fatalf("build: %v", err)
	}
	if len(targets) != 2 {
		t.Fatalf("targets = %d, want 2", len(targets))
	}
	if targets[0].Provider != "alpha" {
		t.Errorf("first target = %s/%s, want alpha first", targets[0].Provider, targets[0].Model)
	}
}

func TestBuildUsesBestModelPerProvider(t *testing.T) {
	e := NewEngine(
		stubAccounts{accs: []AccountRef{{Provider: "alpha"}}},
		stubStats{pairs: []PairStats{
			{Provider: "alpha", Model: "weak", Requests: 10, Failures: 9, AvgLatencyMS: 4000},
			{Provider: "alpha", Model: "strong", Requests: 10, Failures: 0, AvgLatencyMS: 200},
		}},
		nil,
	)
	e.DisableExploration()

	targets, err := e.Build(context.Background(), VariantDefault)
	if err != nil {
		t.Fatalf("build: %v", err)
	}
	if len(targets) != 1 || targets[0].Model != "strong" {
		t.Fatalf("targets = %+v, want the strong model only", targets)
	}
}

func TestBuildSkipsProviderWithoutUsage(t *testing.T) {
	e := NewEngine(
		stubAccounts{accs: []AccountRef{{Provider: "alpha"}, {Provider: "ghost"}}},
		stubStats{pairs: []PairStats{
			{Provider: "alpha", Model: "a1", Requests: 10, Failures: 0, AvgLatencyMS: 200},
		}},
		nil,
	)
	e.DisableExploration()

	targets, err := e.Build(context.Background(), VariantDefault)
	if err != nil {
		t.Fatalf("build: %v", err)
	}
	if len(targets) != 1 || targets[0].Provider != "alpha" {
		t.Fatalf("targets = %+v, want only alpha (no curated catalog to pick ghost's model)", targets)
	}
}

func TestBuildSkipsUnusableAccounts(t *testing.T) {
	e := NewEngine(
		stubAccounts{accs: []AccountRef{
			{Provider: "alpha", Disabled: true},
			{Provider: "beta", NeedsReconnect: true},
		}},
		stubStats{pairs: []PairStats{
			{Provider: "alpha", Model: "a1", Requests: 10},
			{Provider: "beta", Model: "b1", Requests: 10},
		}},
		nil,
	)

	targets, err := e.Build(context.Background(), VariantDefault)
	if err != nil {
		t.Fatalf("build: %v", err)
	}
	if len(targets) != 0 {
		t.Fatalf("targets = %+v, want none: every account is disabled or needs re-auth", targets)
	}
}

func TestBuildEmpty(t *testing.T) {
	e := NewEngine(stubAccounts{}, stubStats{}, nil)
	targets, err := e.Build(context.Background(), VariantFast)
	if err != nil {
		t.Fatalf("build: %v", err)
	}
	if targets != nil {
		t.Fatalf("targets = %+v, want nil for an empty pool", targets)
	}
}

func TestBuildPropagatesSourceErrors(t *testing.T) {
	e := NewEngine(stubAccounts{err: errors.New("db down")}, stubStats{}, nil)
	if _, err := e.Build(context.Background(), VariantDefault); err == nil {
		t.Fatal("expected the account source error to propagate")
	}
	e2 := NewEngine(stubAccounts{accs: []AccountRef{{Provider: "alpha"}}}, stubStats{err: errors.New("db down")}, nil)
	if _, err := e2.Build(context.Background(), VariantDefault); err == nil {
		t.Fatal("expected the stats source error to propagate")
	}
	e3 := NewEngine(stubAccounts{accs: []AccountRef{{Provider: "alpha"}}}, stubStats{}, stubCatalog{err: errors.New("db down")})
	if _, err := e3.Build(context.Background(), VariantDefault); err == nil {
		t.Fatal("expected the catalog source error to propagate")
	}
}

func TestExcludeAfterFailureSelfHealing(t *testing.T) {
	e := NewEngine(
		stubAccounts{accs: []AccountRef{{Provider: "alpha"}}},
		stubStats{pairs: []PairStats{
			{Provider: "alpha", Model: "a1", Requests: 10, Failures: 0, AvgLatencyMS: 200},
		}},
		nil,
	)
	e.DisableExploration()

	for i := 0; i < excludeFailureThreshold; i++ {
		e.ExcludeAfterFailure("alpha", "a1")
	}
	targets, err := e.Build(context.Background(), VariantDefault)
	if err != nil {
		t.Fatalf("build: %v", err)
	}
	if len(targets) != 0 {
		t.Fatalf("targets = %+v, want none while excluded", targets)
	}
	if !e.IsExcluded("alpha", "a1") {
		t.Error("expected alpha/a1 to be excluded")
	}

	// NoteSuccess resets the consecutive-failure counter before the
	// threshold is reached.
	e2 := NewEngine(
		stubAccounts{accs: []AccountRef{{Provider: "alpha"}}},
		stubStats{pairs: []PairStats{{Provider: "alpha", Model: "a1", Requests: 10}}},
		nil,
	)
	for i := 0; i < excludeFailureThreshold-1; i++ {
		e2.ExcludeAfterFailure("alpha", "a1")
	}
	e2.NoteSuccess("alpha", "a1")
	for i := 0; i < excludeFailureThreshold-1; i++ {
		e2.ExcludeAfterFailure("alpha", "a1")
	}
	if e2.IsExcluded("alpha", "a1") {
		t.Error("a success in between must reset the failure counter")
	}
}

func TestBuildExcludesInactiveCatalogModels(t *testing.T) {
	e := NewEngine(
		stubAccounts{accs: []AccountRef{
			{Provider: "alpha"},
			{Provider: "beta"},  // no stored catalog: ungated
			{Provider: "gamma"}, // stored catalog marks nothing active
		}},
		stubStats{pairs: []PairStats{
			// The catalog-disabled model has the better metrics: without the
			// gate it would win alpha's slot.
			{Provider: "alpha", Model: "parked", Requests: 10, Failures: 0, AvgLatencyMS: 100},
			{Provider: "alpha", Model: "served", Requests: 10, Failures: 5, AvgLatencyMS: 4000},
			{Provider: "beta", Model: "b1", Requests: 10, Failures: 0, AvgLatencyMS: 200},
			{Provider: "gamma", Model: "g1", Requests: 10, Failures: 0, AvgLatencyMS: 200},
		}},
		stubCatalog{active: map[string]map[string]bool{
			"alpha": {"served": true},
			"gamma": {},
		}},
	)
	e.DisableExploration()

	targets, err := e.Build(context.Background(), VariantDefault)
	if err != nil {
		t.Fatalf("build: %v", err)
	}
	if len(targets) != 2 {
		t.Fatalf("targets = %+v, want alpha/served and beta/b1 only", targets)
	}
	for _, tgt := range targets {
		if tgt.Provider == "alpha" && tgt.Model != "served" {
			t.Errorf("alpha target = %s, want the catalog-active model", tgt.Model)
		}
		if tgt.Provider == "gamma" {
			t.Error("gamma has no catalog-active models and must be dropped")
		}
	}
}
