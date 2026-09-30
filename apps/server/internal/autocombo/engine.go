// Package autocombo builds virtual auto-combos: an "auto" (or
// "auto/<variant>") model request resolves to an ordered provider/model
// fallback list generated dynamically from the connected accounts and their
// observed usage — no manual configuration. It is a port of IDrouter's
// autocombo engine, adapted to tera-router's data sources: per-pair outcome
// aggregates come from the usage_records table (there is no background health
// prober), so the health factor is derived from the recent failure share.
package autocombo

import (
	"context"
	"math/rand"
	"sort"
	"sync"
	"time"
)

// Weights holds the scoring factor weights. All weights sum to 1.0.
type Weights struct {
	Health       float64 // recent failure share of the provider
	SuccessRate  float64 // historical success rate
	LatencyInv   float64 // inverse latency (faster = higher)
	Stability    float64 // success-rate consistency
	RequestCount float64 // usage volume (prefer battle-tested)
}

// DefaultWeights returns balanced weights for the default variant.
func DefaultWeights() Weights {
	return Weights{
		Health:       0.30,
		SuccessRate:  0.25,
		LatencyInv:   0.20,
		Stability:    0.15,
		RequestCount: 0.10,
	}
}

// WeightsForVariant returns the weight profile for a given variant.
func WeightsForVariant(v Variant) Weights {
	switch v {
	case VariantCoding:
		// Quality-first: prioritize success rate and stability.
		return Weights{Health: 0.20, SuccessRate: 0.40, LatencyInv: 0.15, Stability: 0.20, RequestCount: 0.05}
	case VariantFast:
		// Low-latency: prioritize speed.
		return Weights{Health: 0.25, SuccessRate: 0.20, LatencyInv: 0.40, Stability: 0.10, RequestCount: 0.05}
	case VariantCheap:
		// Volume-first: prefer the battle-tested cheap workhorses.
		return Weights{Health: 0.25, SuccessRate: 0.25, LatencyInv: 0.15, Stability: 0.15, RequestCount: 0.20}
	case VariantOffline:
		// Offline-friendly: maximize stability and success rate.
		return Weights{Health: 0.20, SuccessRate: 0.35, LatencyInv: 0.10, Stability: 0.30, RequestCount: 0.05}
	case VariantSmart:
		// Smart: balanced with a slight quality bias.
		return Weights{Health: 0.25, SuccessRate: 0.30, LatencyInv: 0.20, Stability: 0.15, RequestCount: 0.10}
	case VariantLKGP:
		// Last-known-good-path: maximize stability, minimize exploration.
		return Weights{Health: 0.20, SuccessRate: 0.25, LatencyInv: 0.15, Stability: 0.35, RequestCount: 0.05}
	default:
		return DefaultWeights()
	}
}

// exploreRate returns the per-build probability of rotating the top
// candidates so less-used providers get traffic and build metrics. LKGP never
// explores; the smart variant explores most.
func exploreRate(v Variant) float64 {
	switch v {
	case VariantLKGP:
		return 0
	case VariantSmart:
		return 0.20
	case VariantCoding:
		return 0.05
	default:
		return 0.10
	}
}

// Candidate is a (provider, model) pair with its computed score. One
// candidate exists per provider — its best-scoring observed model — since the
// gateway's planner picks the actual account at request time.
type Candidate struct {
	Provider string
	Model    string
	Score    float64
}

// Target is one entry of a built combo, consumed by the gateway's resolver in
// list order (highest score first).
type Target struct {
	Provider string
	Model    string
}

// AccountRef is the subset of an account row the engine needs.
type AccountRef struct {
	Provider       string
	Disabled       bool
	NeedsReconnect bool
}

// AccountSource lists every registered account.
type AccountSource interface {
	ListAll(ctx context.Context) ([]AccountRef, error)
}

// PairStats aggregates the observed outcome of one provider/model pair over a
// window, mirroring what the usage_records table can answer in one query.
type PairStats struct {
	Provider     string
	Model        string
	Requests     int64
	Failures     int64
	AvgLatencyMS int64
}

// StatsSource serves pair aggregates for a window.
type StatsSource interface {
	ModelStats(ctx context.Context, from time.Time) ([]PairStats, error)
}

// Self-healing tuning: a provider/model pair is excluded from builds after
// excludeFailureThreshold consecutive failed attempts, and the exclusion
// expires on its own after excludeFailureDuration.
const (
	excludeFailureThreshold = 3
	excludeFailureDuration  = 5 * time.Minute

	// statWindow bounds the usage history the metric factors score.
	statWindow = 7 * 24 * time.Hour
	// healthWindow bounds the recent-failure share the health factor reads.
	healthWindow = time.Hour
)

// Engine builds virtual auto-combos from the connected accounts. It is safe
// for concurrent use.
type Engine struct {
	accounts AccountSource
	stats    StatsSource

	mu        sync.Mutex
	excluded  map[string]time.Time // provider/model -> excludeUntil
	failures  map[string]int       // provider/model -> consecutive failures
	noExplore bool                 // test hook: disable bandit exploration
	rng       *rand.Rand
}

// NewEngine creates an auto-combo engine. Both sources are required.
func NewEngine(accounts AccountSource, stats StatsSource) *Engine {
	return &Engine{
		accounts: accounts,
		stats:    stats,
		excluded: make(map[string]time.Time),
		failures: make(map[string]int),
		rng:      rand.New(rand.NewSource(time.Now().UnixNano())),
	}
}

// Build constructs a virtual auto-combo for the given variant: the connected
// providers scored and ordered, best first. Providers whose accounts are all
// disabled or awaiting re-auth are skipped, as are providers with no observed
// usage in the stats window — there is no curated model catalog to fall back
// on for choosing their model.
func (e *Engine) Build(ctx context.Context, variant Variant) ([]Target, error) {
	accs, err := e.accounts.ListAll(ctx)
	if err != nil {
		return nil, err
	}

	weights := WeightsForVariant(variant)
	now := time.Now()

	e.mu.Lock()
	// Lazy cleanup of expired exclusions so the map never grows unbounded.
	for key, until := range e.excluded {
		if !now.Before(until) {
			delete(e.excluded, key)
		}
	}
	e.mu.Unlock()

	// Group usable accounts per provider; sorted for deterministic builds.
	usable := make(map[string]bool)
	var providers []string
	for _, acc := range accs {
		if acc.Disabled || acc.NeedsReconnect {
			continue
		}
		if !usable[acc.Provider] {
			usable[acc.Provider] = true
			providers = append(providers, acc.Provider)
		}
	}
	if len(providers) == 0 {
		return nil, nil
	}
	sort.Strings(providers)

	long, err := e.stats.ModelStats(ctx, now.Add(-statWindow))
	if err != nil {
		return nil, err
	}
	recent, err := e.stats.ModelStats(ctx, now.Add(-healthWindow))
	if err != nil {
		return nil, err
	}

	// Per provider, keep the best-scoring observed model pair; the recent
	// window aggregates feed the health factor per provider.
	best := make(map[string]PairStats, len(long))
	for _, pair := range long {
		cur, ok := best[pair.Provider]
		if !ok || betterPair(pair, cur) {
			best[pair.Provider] = pair
		}
	}
	recentByProvider := make(map[string]PairStats, len(recent))
	for _, pair := range recent {
		agg := recentByProvider[pair.Provider]
		agg.Requests += pair.Requests
		agg.Failures += pair.Failures
		recentByProvider[pair.Provider] = agg
	}

	var candidates []Candidate
	for _, provider := range providers {
		pair, ok := best[provider]
		if !ok {
			continue
		}
		if e.IsExcluded(provider, pair.Model) {
			continue
		}
		c := Candidate{Provider: provider, Model: pair.Model}
		c.Score = scorePair(pair, recentByProvider[provider], weights)
		candidates = append(candidates, c)
	}
	if len(candidates) == 0 {
		return nil, nil
	}

	// Sort by score descending.
	sort.SliceStable(candidates, func(i, j int) bool {
		return candidates[i].Score > candidates[j].Score
	})

	// Exploration: with probability exploreRate(variant), move a random
	// candidate to the front so lower-ranked providers get traffic and build
	// metrics.
	e.mu.Lock()
	noExplore := e.noExplore
	e.mu.Unlock()
	if !noExplore && e.BanditExplore(exploreRate(variant)) && len(candidates) > 1 {
		e.mu.Lock()
		idx := e.rng.Intn(len(candidates))
		e.mu.Unlock()
		chosen := candidates[idx]
		candidates = append(candidates[:idx], candidates[idx+1:]...)
		candidates = append([]Candidate{chosen}, candidates...)
	}

	targets := make([]Target, len(candidates))
	for i, c := range candidates {
		targets[i] = Target{Provider: c.Provider, Model: c.Model}
	}
	return targets, nil
}

// betterPair ranks two observed pairs of one provider: higher metric score
// first, then more requests, then the lexicographically smaller model id for
// determinism.
func betterPair(a, b PairStats) bool {
	sa := scorePair(a, PairStats{}, DefaultWeights())
	sb := scorePair(b, PairStats{}, DefaultWeights())
	if sa != sb {
		return sa > sb
	}
	if a.Requests != b.Requests {
		return a.Requests > b.Requests
	}
	return a.Model < b.Model
}

// scorePair computes the multi-factor score for one provider/model pair.
//
//   - Health comes from the recent (short-window) failure share: under 10%
//     failures is healthy (1.0), up to 50% degraded (0.5), beyond that
//     unhealthy (0.0), and no recent traffic is unknown (0.7) — the neutral
//     mid-range the reference engine uses.
//   - Success rate, inverse latency, stability, and request count come from
//     the long-window pair stats, with the same normalizations the reference
//     engine uses (5s max latency, 1000 requests "well-tested").
func scorePair(pair, recent PairStats, w Weights) float64 {
	var score float64

	switch {
	case recent.Requests == 0:
		score += w.Health * 0.7 // unknown
	case float64(recent.Failures)/float64(recent.Requests) < 0.1:
		score += w.Health * 1.0
	case float64(recent.Failures)/float64(recent.Requests) <= 0.5:
		score += w.Health * 0.5
	default:
		// unhealthy: no contribution
	}

	if pair.Requests == 0 {
		// No history: mid-range for the metric factors except volume.
		score += w.SuccessRate * 0.5
		score += w.LatencyInv * 0.5
		score += w.Stability * 0.5
		return score
	}

	successRate := 1.0 - float64(pair.Failures)/float64(pair.Requests)
	score += w.SuccessRate * successRate

	latencyScore := 1.0 - float64(pair.AvgLatencyMS)/5000.0
	if latencyScore < 0 {
		latencyScore = 0
	}
	if latencyScore > 1 {
		latencyScore = 1
	}
	score += w.LatencyInv * latencyScore

	stabilityScore := successRate * (1.0 - float64(pair.Failures)/float64(pair.Requests))
	score += w.Stability * stabilityScore

	requestScore := float64(pair.Requests) / 1000.0
	if requestScore > 1 {
		requestScore = 1
	}
	score += w.RequestCount * requestScore

	return score
}

// Exclude temporarily excludes a candidate (provider/model) from the pool.
func (e *Engine) Exclude(provider, model string, duration time.Duration) {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.excluded[provider+"/"+model] = time.Now().Add(duration)
}

// ExcludeAfterFailure records a consecutive failure for a provider/model
// pair. After excludeFailureThreshold consecutive failures the pair is
// excluded from builds for excludeFailureDuration — the self-healing trigger
// driven by the gateway's failure accounting.
func (e *Engine) ExcludeAfterFailure(provider, model string) {
	key := provider + "/" + model
	e.mu.Lock()
	e.failures[key]++
	hit := e.failures[key] >= excludeFailureThreshold
	if hit {
		delete(e.failures, key)
	}
	e.mu.Unlock()
	if hit {
		e.Exclude(provider, model, excludeFailureDuration)
	}
}

// NoteSuccess resets the consecutive-failure counter for a provider/model
// pair so a recovered provider is not penalized by stale failures.
func (e *Engine) NoteSuccess(provider, model string) {
	key := provider + "/" + model
	e.mu.Lock()
	delete(e.failures, key)
	e.mu.Unlock()
}

// IsExcluded reports whether a candidate is currently excluded.
func (e *Engine) IsExcluded(provider, model string) bool {
	e.mu.Lock()
	defer e.mu.Unlock()
	until, ok := e.excluded[provider+"/"+model]
	return ok && time.Now().Before(until)
}

// DisableExploration turns off bandit exploration. Intended for tests that
// assert a deterministic ordering.
func (e *Engine) DisableExploration() {
	e.mu.Lock()
	e.noExplore = true
	e.mu.Unlock()
}

// BanditExplore returns true with probability p (0..1). Used for exploration.
func (e *Engine) BanditExplore(p float64) bool {
	if p <= 0 {
		return false
	}
	e.mu.Lock()
	defer e.mu.Unlock()
	return e.rng.Float64() < p
}
