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
	e := NewEngine(stubAccounts{}, stubStats{})
	targets, err := e.Build(context.Background(), VariantFast)
	if err != nil {
		t.Fatalf("build: %v", err)
	}
	if targets != nil {
		t.Fatalf("targets = %+v, want nil for an empty pool", targets)
	}
}

func TestBuildPropagatesSourceErrors(t *testing.T) {
	e := NewEngine(stubAccounts{err: errors.New("db down")}, stubStats{})
	if _, err := e.Build(context.Background(), VariantDefault); err == nil {
		t.Fatal("expected the account source error to propagate")
	}
	e2 := NewEngine(stubAccounts{accs: []AccountRef{{Provider: "alpha"}}}, stubStats{err: errors.New("db down")})
	if _, err := e2.Build(context.Background(), VariantDefault); err == nil {
		t.Fatal("expected the stats source error to propagate")
	}
}

func TestExcludeAfterFailureSelfHealing(t *testing.T) {
	e := NewEngine(
		stubAccounts{accs: []AccountRef{{Provider: "alpha"}}},
		stubStats{pairs: []PairStats{
			{Provider: "alpha", Model: "a1", Requests: 10, Failures: 0, AvgLatencyMS: 200},
		}},
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
