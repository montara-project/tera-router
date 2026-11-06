package handlers

import (
	"sort"
	"time"

	"tera-router/server/internal/app"
	"tera-router/server/internal/dtos"
	"tera-router/server/internal/repositories"

	"github.com/gofiber/fiber/v3"
)

// providerHealthHandler serves GET /v1/provider-health: the dashboard view of
// provider, model, and chain reliability derived from the gateway's own
// attempt rows in usage_records — no active probing, so status reflects the
// traffic that actually flowed through /v1/chat/completions, /v1/messages,
// and /v1/responses.
type providerHealthHandler struct {
	app *app.Application
}

// healthWindows maps the dashboard's window query onto a lookback duration.
var healthWindows = map[string]time.Duration{
	"5m":  5 * time.Minute,
	"15m": 15 * time.Minute,
	"1h":  time.Hour,
	"6h":  6 * time.Hour,
	"24h": 24 * time.Hour,
	"7d":  7 * 24 * time.Hour,
	"30d": 30 * 24 * time.Hour,
	"90d": 90 * 24 * time.Hour,
}

// Overview aggregates the window's usage rows into per-provider, per-model,
// and per-chain health entries (?window=5m|15m|1h|6h|24h|7d|30d|90d, default 15m).
func (h *providerHealthHandler) Overview(c fiber.Ctx) error {
	window := c.Query("window", "15m")
	lookback, ok := healthWindows[window]
	if !ok {
		window = "15m"
		lookback = 15 * time.Minute
	}

	now := time.Now()
	from := now.Add(-lookback)
	rows, err := h.app.Repos.Usage.HealthRows(c.Context(), from)
	if err != nil {
		return err
	}
	chains, err := h.app.Repos.Chains.List(c.Context())
	if err != nil {
		return err
	}

	knownChains := make([]string, 0, len(chains))
	for _, ch := range chains {
		knownChains = append(knownChains, ch.Name)
	}
	out := buildHealthOverview(rows, knownChains, from, now)
	// Telemetry keys providers by slug; show their display names.
	names, _, _, err := (&usageHandler{app: h.app}).providerMeta(c.Context())
	if err != nil {
		return err
	}
	for i := range out.Providers {
		out.Providers[i].Name = providerDisplayName(names, out.Providers[i].ID)
	}
	return dtos.OK(c, out)
}

// healthEntry is one row of the dashboard's provider/model/chain tables; it
// mirrors the web-ui HealthEntry shape. Requests counts attempts (successes
// plus failures), not client requests.
type healthEntry struct {
	ID            string  `json:"id"`
	Name          string  `json:"name"`
	Status        string  `json:"status"`
	Requests      int     `json:"requests"`
	FallbackRate  float64 `json:"fallbackRate"`
	Fallbacks     int     `json:"fallbacks"`
	FinalFailures int     `json:"finalFailures"`
	// MainIssue is the most frequent failure kind (auth, rate_limit, …);
	// empty when nothing failed.
	MainIssue string `json:"mainIssue"`
	// MostAffected is set on chains only: the model whose attempts failed most.
	MostAffected string  `json:"mostAffected,omitempty"`
	Affected     *string `json:"affected"`
	// SuccessRate is successful attempts over all attempts (percent).
	SuccessRate float64 `json:"successRate"`
	// P95Ms is the p95 latency of the successful attempts.
	P95Ms int `json:"p95Ms"`
	// Buckets splits the window into healthBuckets equal slices, oldest
	// first, for the dashboard's timeline strip.
	Buckets []healthBucket `json:"buckets"`
	// Served is set on chains only: successful attempts per model, busiest
	// first, which is how traffic actually spread over the chain's steps.
	Served []servedModel `json:"served,omitempty"`
}

// healthBuckets is how many timeline slices each entry reports (hourly for
// the 24h window).
const healthBuckets = 24

type healthBucket struct {
	Requests int `json:"requests"`
	Failed   int `json:"failed"`
}

type servedModel struct {
	Model    string `json:"model"`
	Requests int    `json:"requests"`
}

type healthOverview struct {
	Fallbacks int `json:"fallbacks"`
	// Requests counts client requests (attempts sharing a request id are one).
	Requests  int           `json:"requests"`
	AvgP95Ms  int64         `json:"avgP95Ms"`
	Providers []healthEntry `json:"providers"`
	Models    []healthEntry `json:"models"`
	Chains    []healthEntry `json:"chains"`
	Probes    []struct{}    `json:"probes"`
}

// healthStatus thresholds. "down" means every attempt failed, "degraded" means
// users saw failures (or heavy fallback churn), "healthy" is everything else —
// including no traffic, which is indistinguishable from "nothing went wrong".
// The churn threshold needs a minimum sample so one fallback among a handful
// of attempts does not flag the provider.
const (
	degradedFallbackRate = 10.0
	minAttemptsForChurn  = 10
)

func healthStatus(attempts, successes, finalFailures int, fallbackRate float64) string {
	switch {
	case attempts > 0 && successes == 0:
		return "down"
	case finalFailures > 0 || (attempts >= minAttemptsForChurn && fallbackRate >= degradedFallbackRate):
		return "degraded"
	default:
		return "healthy"
	}
}

// groupStats accumulates one entity's outcomes across the window.
type groupStats struct {
	attempts       int
	successes      int
	fallbacks      int
	finalFailures  int
	latencies      []int
	affectedChains map[string]bool
	buckets        []healthBucket
	served         map[string]int
	errorKinds     map[string]int
	failedModels   map[string]int
}

// record adds one attempt to the timeline bucket it falls in.
func (g *groupStats) record(bucket int, failed bool) {
	if bucket < 0 {
		return
	}
	g.buckets[bucket].Requests++
	if failed {
		g.buckets[bucket].Failed++
	}
}

func (g *groupStats) entry(id string) healthEntry {
	fallbackRate := 0.0
	if g.attempts > 0 {
		v := float64(g.fallbacks) / float64(g.attempts) * 100
		fallbackRate = round1(v)
	}
	e := healthEntry{
		ID:            id,
		Name:          id,
		Status:        healthStatus(g.attempts, g.successes, g.finalFailures, fallbackRate),
		Requests:      g.attempts,
		FallbackRate:  fallbackRate,
		Fallbacks:     g.fallbacks,
		FinalFailures: g.finalFailures,
		MainIssue:     topKey(g.errorKinds),
		SuccessRate:   percent(int64(g.successes), int64(g.attempts)),
		P95Ms:         percentile(g.latencies, 0.95),
		Buckets:       g.buckets,
	}
	for model, n := range g.served {
		e.Served = append(e.Served, servedModel{Model: model, Requests: n})
	}
	sort.Slice(e.Served, func(i, j int) bool {
		if e.Served[i].Requests != e.Served[j].Requests {
			return e.Served[i].Requests > e.Served[j].Requests
		}
		return e.Served[i].Model < e.Served[j].Model
	})
	if len(g.affectedChains) > 0 {
		chains := make([]string, 0, len(g.affectedChains))
		for name := range g.affectedChains {
			chains = append(chains, name)
		}
		sort.Strings(chains)
		joined := ""
		for i, name := range chains {
			if i > 0 {
				joined += ", "
			}
			joined += name
		}
		e.Affected = &joined
	}
	return e
}

func round1(v float64) float64 {
	return float64(int(v*10+0.5)) / 10
}

// buildHealthOverview classifies every attempt row through its request group
// and places it in one of the healthBuckets slices of [from, to):
// a failed attempt whose request later succeeded is a fallback, one whose
// request never succeeded is a final failure. Rows carry empty request ids
// (legacy data written before attribution) group as their own request, so old
// failures count as final ones.
func buildHealthOverview(rows []repositories.UsageHealthRow, knownChains []string, from, to time.Time) healthOverview {
	succeededRequests := make(map[string]bool, len(rows))
	for _, r := range rows {
		if !r.Failed && r.RequestID != "" {
			succeededRequests[r.RequestID] = true
		}
	}

	providerStats := map[string]*groupStats{}
	modelStats := map[string]*groupStats{}
	chainStats := map[string]*groupStats{}
	group := func(m map[string]*groupStats, key string) *groupStats {
		g, ok := m[key]
		if !ok {
			g = newGroupStats()
			m[key] = g
		}
		return g
	}
	span := to.Sub(from)
	bucketOf := func(at time.Time) int {
		if span <= 0 {
			return -1
		}
		return min(max(int(at.Sub(from)*healthBuckets/span), 0), healthBuckets-1)
	}

	totalFallbacks := 0
	requests := map[string]bool{}
	legacyRequests := 0
	for _, r := range rows {
		if r.RequestID == "" {
			legacyRequests++
		} else {
			requests[r.RequestID] = true
		}
		fallback := r.Failed && succeededRequests[r.RequestID]
		if fallback {
			totalFallbacks++
		}
		bucket := bucketOf(r.CreatedAt)

		for _, g := range []*groupStats{
			group(providerStats, r.Provider),
			group(modelStats, r.Provider+"/"+r.Model),
		} {
			g.record(bucket, r.Failed)
			g.attempts++
			if r.Failed {
				if r.ErrorKind != "" {
					g.errorKinds[r.ErrorKind]++
				}
				if fallback {
					g.fallbacks++
				} else {
					g.finalFailures++
				}
				if r.Chain != "" {
					g.affectedChains[r.Chain] = true
				}
			} else {
				g.successes++
				g.latencies = append(g.latencies, r.LatencyMS)
			}
		}

		if r.Chain != "" {
			g := group(chainStats, r.Chain)
			g.record(bucket, r.Failed)
			g.attempts++
			if r.Failed {
				if r.ErrorKind != "" {
					g.errorKinds[r.ErrorKind]++
				}
				g.failedModels[r.Provider+"/"+r.Model]++
				if fallback {
					g.fallbacks++
				} else {
					g.finalFailures++
				}
			} else {
				g.successes++
				g.latencies = append(g.latencies, r.LatencyMS)
				g.served[r.Model]++
			}
		}
	}

	// Chains with no window traffic still appear: the operator configured them
	// and "nothing observed" reads as healthy.
	for _, name := range knownChains {
		if _, ok := chainStats[name]; !ok {
			chainStats[name] = newGroupStats()
		}
	}

	providers := entriesSorted(providerStats)
	models := entriesSorted(modelStats)
	chainEntries := entriesSorted(chainStats)

	var p95Sum int64
	var p95Count int64
	for _, g := range providerStats {
		if len(g.latencies) == 0 {
			continue
		}
		p95Sum += int64(percentile(g.latencies, 0.95))
		p95Count++
	}
	avgP95 := int64(0)
	if p95Count > 0 {
		avgP95 = p95Sum / p95Count
	}

	// probes stay empty until the guardrails endpoints exist server-side.
	return healthOverview{
		Fallbacks: totalFallbacks,
		Requests:  len(requests) + legacyRequests,
		AvgP95Ms:  avgP95,
		Providers: providers,
		Models:    models,
		Chains:    chainEntries,
		Probes:    []struct{}{},
	}
}

func newGroupStats() *groupStats {
	return &groupStats{
		affectedChains: map[string]bool{},
		buckets:        make([]healthBucket, healthBuckets),
		served:         map[string]int{},
		errorKinds:     map[string]int{},
		failedModels:   map[string]int{},
	}
}

// topKey returns the key with the highest count (ties go to the smaller key),
// or "" for an empty map.
func topKey(counts map[string]int) string {
	best, bestN := "", 0
	for k, n := range counts {
		if n > bestN || (n == bestN && k < best) {
			best, bestN = k, n
		}
	}
	return best
}

// entriesSorted renders one stats map as a stable, name-ordered entry list.
func entriesSorted(stats map[string]*groupStats) []healthEntry {
	names := make([]string, 0, len(stats))
	for name := range stats {
		names = append(names, name)
	}
	sort.Strings(names)
	out := make([]healthEntry, 0, len(names))
	for _, name := range names {
		e := stats[name].entry(name)
		e.MostAffected = topKey(stats[name].failedModels)
		out = append(out, e)
	}
	return out
}

// percentile returns the p-th percentile (0..1) of an unsorted latency sample
// (nearest-rank), or 0 for an empty sample.
func percentile(sample []int, p float64) int {
	if len(sample) == 0 {
		return 0
	}
	cp := make([]int, len(sample))
	copy(cp, sample)
	sort.Ints(cp)
	return cp[int(float64(len(cp)-1)*p)]
}
