package handlers

import (
	"testing"

	"tera-router/server/internal/repositories"
)

func TestHealthStatus(t *testing.T) {
	cases := []struct {
		name          string
		attempts      int
		successes     int
		finalFailures int
		fallbackRate  float64
		want          string
	}{
		{"no traffic is healthy", 0, 0, 0, 0, "healthy"},
		{"all success is healthy", 10, 10, 0, 0, "healthy"},
		{"small fallback churn is healthy", 100, 100, 0, 2.5, "healthy"},
		{"heavy fallback churn degrades", 10, 10, 0, 12.0, "degraded"},
		{"final failures degrade", 10, 9, 1, 0, "degraded"},
		{"no successes at all is down", 10, 0, 10, 100, "down"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := healthStatus(tc.attempts, tc.successes, tc.finalFailures, tc.fallbackRate)
			if got != tc.want {
				t.Fatalf("healthStatus = %q, want %q", got, tc.want)
			}
		})
	}
}

func TestBuildHealthOverview(t *testing.T) {
	rows := []repositories.UsageHealthRow{
		// Request r1: openai attempt failed, then anthropic succeeded -> the
		// openai row is a fallback, anthropic's is a success.
		{RequestID: "r1", Chain: "combo", Provider: "openai", Model: "gpt-4o", Failed: true, LatencyMS: 200},
		{RequestID: "r1", Chain: "combo", Provider: "anthropic", Model: "claude-sonnet-4", Failed: false, LatencyMS: 300},
		// Request r2: glm-cn failed twice and the request never succeeded ->
		// two final failures.
		{RequestID: "r2", Chain: "glm-free", Provider: "glm-cn", Model: "glm-4-flash", Failed: true, LatencyMS: 100},
		{RequestID: "r2", Chain: "glm-free", Provider: "glm-cn", Model: "glm-4-flash", Failed: true, LatencyMS: 100},
		// Request r3: clean direct call with no chain.
		{RequestID: "r3", Chain: "", Provider: "openai", Model: "gpt-4o", Failed: false, LatencyMS: 500},
	}

	got := buildHealthOverview(rows, []string{"combo", "glm-free", "idle-chain"})

	if got.Fallbacks != 1 {
		t.Fatalf("fallbacks = %d, want 1", got.Fallbacks)
	}

	if len(got.Providers) != 3 {
		t.Fatalf("providers = %d rows, want 3 (anthropic, glm-cn, openai)", len(got.Providers))
	}
	var openai, anthropic, glmcn healthEntry
	for _, p := range got.Providers {
		switch p.Name {
		case "openai":
			openai = p
		case "anthropic":
			anthropic = p
		case "glm-cn":
			glmcn = p
		}
	}
	if openai.Requests != 2 || openai.FallbackRate != 50 || openai.FinalFailures != 0 || openai.Status != "healthy" {
		t.Fatalf("openai = %+v, want 2 reqs, 50%% fallback, healthy", openai)
	}
	if openai.Affected == nil || *openai.Affected != "combo" {
		t.Fatalf("openai affected = %v, want combo", openai.Affected)
	}
	if anthropic.Requests != 1 || anthropic.Status != "healthy" || anthropic.Affected != nil {
		t.Fatalf("anthropic = %+v, want 1 healthy req with no affected chains", anthropic)
	}
	if glmcn.Status != "down" || glmcn.FinalFailures != 2 || glmcn.FallbackRate != 0 {
		t.Fatalf("glm-cn = %+v, want down with 2 final failures", glmcn)
	}

	// Models aggregate the same way, keyed by upstream id.
	var gpt4o, glm4 healthEntry
	for _, m := range got.Models {
		switch m.Name {
		case "gpt-4o":
			gpt4o = m
		case "glm-4-flash":
			glm4 = m
		}
	}
	if gpt4o.Requests != 2 || glm4.Status != "down" {
		t.Fatalf("models: gpt-4o = %+v, glm-4-flash = %+v", gpt4o, glm4)
	}

	// Chains include configured ones with no traffic; only failing chains are
	// named as affected.
	var idle healthEntry
	affectedSeen := 0
	for _, ch := range got.Chains {
		if ch.Name == "idle-chain" {
			idle = ch
		}
		if ch.Affected != nil {
			affectedSeen++
		}
	}
	if idle.Name != "idle-chain" || idle.Requests != 0 || idle.Status != "healthy" {
		t.Fatalf("idle-chain = %+v, want a zero-traffic healthy row", idle)
	}
	if affectedSeen != 0 {
		t.Fatalf("chains.affected must stay nil (only providers/models carry it), got %d", affectedSeen)
	}
}

func TestBuildHealthOverviewLegacyRows(t *testing.T) {
	// Pre-attribution rows carry an empty request id: each failure is its own
	// request group and reads as a final failure.
	rows := []repositories.UsageHealthRow{
		{Provider: "openai", Model: "gpt-4o", Failed: true, LatencyMS: 120},
		{Provider: "openai", Model: "gpt-4o", Failed: false, LatencyMS: 340},
	}
	got := buildHealthOverview(rows, nil)
	if got.Fallbacks != 0 {
		t.Fatalf("fallbacks = %d, want 0 for legacy rows", got.Fallbacks)
	}
	for _, p := range got.Providers {
		if p.Name == "openai" && (p.FinalFailures != 1 || p.Status != "degraded") {
			t.Fatalf("openai legacy = %+v, want 1 final failure, degraded", p)
		}
	}
}
