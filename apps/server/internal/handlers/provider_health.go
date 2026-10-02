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
}

// Overview aggregates the window's usage rows into per-provider, per-model,
// and per-chain health entries (?window=5m|15m|1h|6h|24h|7d, default 15m).
func (h *providerHealthHandler) Overview(c fiber.Ctx) error {
	window := c.Query("window", "15m")
	lookback, ok := healthWindows[window]
	if !ok {
		window = "15m"
		lookback = 15 * time.Minute
	}

	rows, err := h.app.Repos.Usage.HealthRows(c.Context(), time.Now().Add(-lookback))
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
	return dtos.OK(c, buildHealthOverview(rows, knownChains))
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
	FinalFailures int     `json:"finalFailures"`
	Affected      *string `json:"affected"`
}

type healthOverview struct {
	Fallbacks int           `json:"fallbacks"`
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
		FinalFailures: g.finalFailures,
	}
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

// buildHealthOverview classifies every attempt row through its request group:
// a failed attempt whose request later succeeded is a fallback, one whose
// request never succeeded is a final failure. Rows carry empty request ids
// (legacy data written before attribution) group as their own request, so old
// failures count as final ones.
func buildHealthOverview(rows []repositories.UsageHealthRow, knownChains []string) healthOverview {
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
			g = &groupStats{affectedChains: map[string]bool{}}
			m[key] = g
		}
		return g
	}

	totalFallbacks := 0
	for _, r := range rows {
		fallback := r.Failed && succeededRequests[r.RequestID]
		if fallback {
			totalFallbacks++
		}

		for _, g := range []*groupStats{
			group(providerStats, r.Provider),
			group(modelStats, r.Model),
		} {
			g.attempts++
			if r.Failed {
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
			g.attempts++
			if r.Failed {
				if fallback {
					g.fallbacks++
				} else {
					g.finalFailures++
				}
			} else {
				g.successes++
				g.latencies = append(g.latencies, r.LatencyMS)
			}
		}
	}

	// Chains with no window traffic still appear: the operator configured them
	// and "nothing observed" reads as healthy.
	for _, name := range knownChains {
		if _, ok := chainStats[name]; !ok {
			chainStats[name] = &groupStats{affectedChains: map[string]bool{}}
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
		p95Sum += int64(percentile95(g.latencies))
		p95Count++
	}
	avgP95 := int64(0)
	if p95Count > 0 {
		avgP95 = p95Sum / p95Count
	}

	// probes stay empty until the guardrails endpoints exist server-side.
	return healthOverview{
		Fallbacks: totalFallbacks,
		AvgP95Ms:  avgP95,
		Providers: providers,
		Models:    models,
		Chains:    chainEntries,
		Probes:    []struct{}{},
	}
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
		out = append(out, stats[name].entry(name))
	}
	return out
}

// percentile95 returns the p95 of an unsorted latency sample (nearest-rank).
func percentile95(sorted []int) int {
	if len(sorted) == 0 {
		return 0
	}
	cp := make([]int, len(sorted))
	copy(cp, sorted)
	sort.Ints(cp)
	idx := int(float64(len(cp)-1) * 0.95)
	return cp[idx]
}
