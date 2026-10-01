package handlers

import (
	"bytes"
	"encoding/json"
	"testing"
	"time"

	"tera-router/server/internal/dtos"
	"tera-router/server/internal/models"
	"tera-router/server/internal/repositories"
)

// The token-class helpers are the part of the telemetry builder with real
// arithmetic in it: the dashboard's input/cache/output split and its cost
// figures must agree with the gateway's charge, so the "uncached input"
// subtraction and the pricing lookup are pinned here.

func TestStandardInputSubtractsBothCacheClasses(t *testing.T) {
	cases := []struct {
		name                             string
		prompt, cached, cacheWrite, want int64
	}{
		{name: "no cache", prompt: 100, want: 100},
		{name: "cache read only", prompt: 100, cached: 40, want: 60},
		{name: "cache write only", prompt: 100, cacheWrite: 25, want: 75},
		{name: "both classes", prompt: 100, cached: 40, cacheWrite: 25, want: 35},
		// An upstream reporting more cached tokens than prompt tokens must not
		// produce a negative input count.
		{name: "over-reported cache clamps to zero", prompt: 10, cached: 40, want: 0},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := standardInputParts(tc.prompt, tc.cached, tc.cacheWrite); got != tc.want {
				t.Errorf("standardInput = %d, want %d", got, tc.want)
			}
		})
	}
}

func TestStandardInputRecordMatchesGroup(t *testing.T) {
	record := models.UsageRecord{PromptTokens: 100, CachedTokens: 40, CacheWriteTokens: 10}
	group := repositories.UsageGroup{PromptTokens: 100, CachedTokens: 40, CacheWriteTokens: 10}
	if standardInputRecord(record) != standardInput(group) {
		t.Errorf("record %d != group %d", standardInputRecord(record), standardInput(group))
	}
}

func TestPercentAndDivide(t *testing.T) {
	if got := percent(1, 3); got != 33.3 {
		t.Errorf("percent(1,3) = %v, want 33.3", got)
	}
	if got := percent(3, 3); got != 100 {
		t.Errorf("percent(3,3) = %v, want 100", got)
	}
	// An empty window must not divide by zero.
	if got := percent(0, 0); got != 0 {
		t.Errorf("percent(0,0) = %v, want 0", got)
	}
	if got := divide(10, 4); got != 2 {
		t.Errorf("divide(10,4) = %d, want 2", got)
	}
	if got := divide(10, 0); got != 0 {
		t.Errorf("divide(10,0) = %d, want 0", got)
	}
}

func TestModelRowsNullCostWhenUnpriced(t *testing.T) {
	groups := []repositories.UsageGroup{
		{Provider: "openai", Model: "priced", Requests: 3, PromptTokens: 100, CachedTokens: 40, CostMicros: 42},
		{Provider: "openai", Model: "unpriced", Requests: 2, PromptTokens: 50},
	}
	rates := map[string]models.PricingOverride{
		pricingKey("openai", "priced"): {
			InputMicros: 435000, OutputMicros: 870000, CacheReadMicros: 3625,
		},
	}

	rows := modelRows(groups, rates, nil)
	if len(rows) != 2 {
		t.Fatalf("rows = %d, want 2", len(rows))
	}

	priced := rows[0]
	if priced.CostMicros == nil || *priced.CostMicros != 42 {
		t.Errorf("priced cost = %v, want 42", priced.CostMicros)
	}
	if !priced.HasPricingKey || priced.Coverage != 100 {
		t.Errorf("priced row = %+v, want pricing key and full coverage", priced)
	}
	if priced.InputTokens != 60 {
		t.Errorf("priced input = %d, want 60 (uncached)", priced.InputTokens)
	}
	if priced.PricingRates == nil || *priced.PricingRates != "$0.435 in · $0.003625 cache read · $0.87 out" {
		t.Errorf("rates = %v", priced.PricingRates)
	}

	unpriced := rows[1]
	if unpriced.CostMicros != nil {
		t.Errorf("unpriced cost = %v, want null so the table shows Unpriced", *unpriced.CostMicros)
	}
	if unpriced.HasPricingKey || unpriced.Coverage != 0 {
		t.Errorf("unpriced row = %+v", unpriced)
	}
	if unpriced.PricingRates != nil {
		t.Errorf("unpriced rates = %v, want null", *unpriced.PricingRates)
	}
}

// A priced group whose recorded cost is zero (priced after the fact) is
// re-derived from the current rates instead of reading as free.
func TestModelRowsDeriveCostWhenRecordedZero(t *testing.T) {
	groups := []repositories.UsageGroup{
		{Provider: "openai", Model: "gpt-4o-mini", Requests: 1, PromptTokens: 1_000_000, CompletionTokens: 1_000_000},
	}
	rates := map[string]models.PricingOverride{
		pricingKey("openai", "gpt-4o-mini"): {InputMicros: 150_000, OutputMicros: 600_000},
	}

	rows := modelRows(groups, rates, nil)
	if rows[0].CostMicros == nil || *rows[0].CostMicros != 750_000 {
		t.Errorf("cost = %v, want the derived 750000", rows[0].CostMicros)
	}
	if rows[0].PricingRates == nil {
		t.Error("pricing rates = nil, want the formatted rates")
	}
}

// fillFallbackRates resolves grouped models without a per-model override from
// the provider-level row first, then the compiled-in table; unknown models
// stay missing so they render Unpriced, and explicit overrides are untouched.
func TestFillFallbackRates(t *testing.T) {
	groups := []repositories.UsageGroup{
		{Provider: "openai", Model: "gpt-4o"},
		{Provider: "openai", Model: "gpt-4o-mini"},
		{Provider: "acme", Model: "custom-model"},
		{Provider: "zeta", Model: "mystery"},
	}
	rates := map[string]models.PricingOverride{
		pricingKey("openai", "gpt-4o"): {InputMicros: 1},
	}
	providerLevel := map[string]models.PricingOverride{
		"acme": {Provider: "acme", InputMicros: 7},
	}

	fillFallbackRates(rates, providerLevel, groups)

	if r := rates[pricingKey("openai", "gpt-4o")]; r.InputMicros != 1 {
		t.Errorf("explicit override = %+v, want it untouched", r)
	}
	if r, ok := rates[pricingKey("acme", "custom-model")]; !ok || r.InputMicros != 7 {
		t.Errorf("provider-level fallback = %+v ok=%v, want the acme row", r, ok)
	}
	if r, ok := rates[pricingKey("openai", "gpt-4o-mini")]; !ok || r.InputMicros != 150_000 {
		t.Errorf("builtin fallback = %+v ok=%v, want openai gpt-4o-mini rates", r, ok)
	}
	if _, ok := rates[pricingKey("zeta", "mystery")]; ok {
		t.Error("unknown model must stay unpriced")
	}
}

func TestRequestRowsCostNullForFailedAndUnpriced(t *testing.T) {
	records := []models.UsageRecord{
		{ID: 3, Provider: "openai", Model: "priced", PromptTokens: 100, CachedTokens: 40, CompletionTokens: 10, CostMicros: 9, LatencyMS: 250},
		{ID: 2, Provider: "openai", Model: "unpriced", PromptTokens: 100, CompletionTokens: 10, CostMicros: 0},
		{ID: 1, Provider: "anthropic", Model: "priced", Failed: true, ErrorKind: "upstream"},
	}
	rates := map[string]models.PricingOverride{pricingKey("openai", "priced"): {InputMicros: 1}}

	rows := requestRows(records, rates, time.Now(), nil)
	if len(rows) != 3 {
		t.Fatalf("rows = %d, want 3", len(rows))
	}

	if rows[0].CostMicros == nil || *rows[0].CostMicros != 9 {
		t.Errorf("priced cost = %v, want 9", rows[0].CostMicros)
	}
	if rows[0].Usage != "provider" || rows[0].Status != "success" {
		t.Errorf("priced row = %+v", rows[0])
	}
	if rows[0].InputTokens != 60 {
		t.Errorf("priced input = %d, want 60", rows[0].InputTokens)
	}

	if rows[1].CostMicros != nil || rows[1].CostNote != nil {
		t.Errorf("unpriced row = %+v, want null cost and no note", rows[1])
	}

	failed := rows[2]
	if failed.Status != "failed" || failed.Usage != "none" {
		t.Errorf("failed row = %+v, want failed/none", failed)
	}
	if failed.CostMicros != nil {
		t.Errorf("failed cost = %v, want null", *failed.CostMicros)
	}
	if failed.CostNote == nil || *failed.CostNote != "No billable usage" {
		t.Errorf("failed note = %v", failed.CostNote)
	}
}

// A priced request recorded at zero cost is re-derived from the current rates.
func TestRequestRowsDeriveCostWhenRecordedZero(t *testing.T) {
	records := []models.UsageRecord{
		{ID: 5, Provider: "openai", Model: "gpt-4o-mini", PromptTokens: 1_000_000, CompletionTokens: 1_000_000},
	}
	rates := map[string]models.PricingOverride{
		pricingKey("openai", "gpt-4o-mini"): {InputMicros: 150_000, OutputMicros: 600_000},
	}

	rows := requestRows(records, rates, time.Now(), nil)
	if rows[0].CostMicros == nil || *rows[0].CostMicros != 750_000 {
		t.Errorf("cost = %v, want the derived 750000", rows[0].CostMicros)
	}
}

func TestProviderRowsUseDisplayNameAndCoverage(t *testing.T) {
	groups := []repositories.UsageGroup{
		{Provider: "custom-openai", Model: "m", Requests: 4, Failed: 1, PromptTokens: 100, CachedTokens: 40, CostMicros: 5},
	}
	derived := map[string]int64{"custom-openai": 5}
	priced := map[string]int64{"custom-openai": 4}
	names := map[string]string{"custom-openai": "Custom (OpenAI-compatible)"}

	rows := providerRows(groups, derived, priced, names, nil)
	if len(rows) != 1 {
		t.Fatalf("rows = %d, want 1", len(rows))
	}
	row := rows[0]
	if row.Provider != "Custom (OpenAI-compatible)" || row.Slug != "custom-openai" {
		t.Errorf("name/slug = %q/%q", row.Provider, row.Slug)
	}
	if row.SuccessPct != 75 {
		t.Errorf("success = %v, want 75", row.SuccessPct)
	}
	if row.InputTokens != 60 {
		t.Errorf("input = %d, want 60", row.InputTokens)
	}
	if row.Coverage != 100 || row.PricingEst != 4 {
		t.Errorf("coverage = %v/%d, want 100/4", row.Coverage, row.PricingEst)
	}
	if row.CostMicros != 5 {
		t.Errorf("cost = %d, want the derived 5", row.CostMicros)
	}
}

// A provider with no recorded cost but priced models shows the derived
// per-model sum instead of reading as free.
func TestProviderRowsDeriveCostWhenRecordedZero(t *testing.T) {
	groups := []repositories.UsageGroup{
		{Provider: "openai", Requests: 2, PromptTokens: 100, CachedTokens: 40, CostMicros: 0},
	}
	derived := map[string]int64{"openai": 123}

	rows := providerRows(groups, derived, map[string]int64{"openai": 2}, nil, nil)
	if rows[0].CostMicros != 123 {
		t.Errorf("cost = %d, want the derived 123", rows[0].CostMicros)
	}
}

// The provider totals are the per-model sums: a priced group contributes
// groupCost and an unpriced group its recorded cost, so spend recorded under
// a since-deleted override is not dropped, and a provider group's own
// recorded (possibly stale or partial) total never short-circuits it.
func TestCostByProviderMixesDerivedAndRecorded(t *testing.T) {
	groups := []repositories.UsageGroup{
		// Priced now, recorded at zero (priced after the fact): re-derived
		// from the current rates — 100 prompt tokens at $0.15/M → 15 micros.
		{Provider: "openai", Model: "gpt-4o-mini", Requests: 2, PromptTokens: 100},
		// Pricing since deleted: only the recorded figure is left, and it
		// must still reach the provider total.
		{Provider: "openai", Model: "orphan", Requests: 1, PromptTokens: 50, CostMicros: 300},
	}
	rates := map[string]models.PricingOverride{
		pricingKey("openai", "gpt-4o-mini"): {InputMicros: 150_000},
	}

	derived, priced := costByProvider(groups, rates)
	if derived["openai"] != 315 {
		t.Errorf("derived = %d, want 315 (15 re-derived + 300 recorded)", derived["openai"])
	}
	if priced["openai"] != 2 {
		t.Errorf("priced requests = %d, want 2", priced["openai"])
	}
}

func TestProviderDisplayNameFallsBackToSlug(t *testing.T) {
	if got := providerDisplayName(map[string]string{}, "ghost-provider"); got != "ghost-provider" {
		t.Errorf("display name = %q, want the slug", got)
	}
	if got := providerDisplayName(map[string]string{"openai": "OpenAI"}, "openai"); got != "OpenAI" {
		t.Errorf("display name = %q, want OpenAI", got)
	}
}

func TestDistributionSharesAndOrdering(t *testing.T) {
	groups := []repositories.UsageGroup{
		{Provider: "small", Requests: 1, PromptTokens: 10},
		{Provider: "big", Requests: 3, PromptTokens: 90},
	}

	out := distribution(groups, 4, 100, nil)
	if out[0].Provider != "big" {
		t.Fatalf("ordering = %s first, want big", out[0].Provider)
	}
	if out[0].RequestShare != 75 || out[0].TokenShare != 90 {
		t.Errorf("big shares = %v/%v, want 75/90", out[0].RequestShare, out[0].TokenShare)
	}
}

func TestTrendPointsFormatDayAndBusiest(t *testing.T) {
	daily := []repositories.UsageDailyWithFailures{
		{Day: "2026-09-05", Requests: 2, CostMicros: 10, Tokens: 30, Failed: 1},
		{Day: "2026-09-07", Requests: 9, CostMicros: 40, Tokens: 90},
	}

	points := trendPoints(daily)
	if points[0].Day != "Sep 05" || points[1].Day != "Sep 07" {
		t.Errorf("labels = %q/%q, want Sep 05/Sep 07", points[0].Day, points[1].Day)
	}
	if points[0].Failures != 1 {
		t.Errorf("failures = %d, want 1", points[0].Failures)
	}
	if got := busiestDay(daily); got != "Sep 07" {
		t.Errorf("busiest = %q, want Sep 07", got)
	}
	if got := busiestDay(nil); got != "" {
		t.Errorf("busiest of empty window = %q, want empty", got)
	}
}

func TestRelativeTimeBuckets(t *testing.T) {
	now := time.Date(2026, 9, 29, 12, 0, 0, 0, time.UTC)
	cases := []struct {
		when time.Time
		want string
	}{
		{now.Add(-30 * time.Second), "just now"},
		{now.Add(-5 * time.Minute), "5m ago"},
		{now.Add(-3 * time.Hour), "3h ago"},
		{now.Add(-50 * time.Hour), "2d ago"},
		{time.Time{}, ""},
	}
	for _, tc := range cases {
		if got := relativeTime(tc.when, now); got != tc.want {
			t.Errorf("relativeTime(%v) = %q, want %q", tc.when, got, tc.want)
		}
	}
}

func TestFormatRatesOmitsZeroBuckets(t *testing.T) {
	got := formatRates(models.PricingOverride{InputMicros: 435000, OutputMicros: 870000})
	if got != "$0.435 in · $0.87 out" {
		t.Errorf("formatRates = %q", got)
	}
	got = formatRates(models.PricingOverride{InputMicros: 1000000, CacheWriteMicros: 1250000, OutputMicros: 2000000})
	if got != "$1 in · $1.25 cache write · $2 out" {
		t.Errorf("formatRates = %q", got)
	}
}

// The DTO's JSON keys are the page's contract; a rename would silently blank
// fields in the UI, so the shape is pinned.
func TestUsageTelemetryJSONKeys(t *testing.T) {
	// Nested row types only contribute their keys when a row is present, so
	// the fixture carries one of each.
	telemetry := dtos.UsageTelemetry{
		Trend:          []dtos.UsageTelemetryTrendPoint{{Day: "Sep 07"}},
		Distribution:   []dtos.UsageTelemetryProvider{{Provider: "openai"}},
		ProviderRows:   []dtos.UsageTelemetryProviderRow{{ID: "pa-1"}},
		ModelRows:      []dtos.UsageTelemetryModelRow{{ID: "m-1"}},
		RecentRequests: []dtos.UsageTelemetryRequestRow{{ID: "1"}},
	}
	encoded, err := json.Marshal(telemetry)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	for _, key := range []string{
		`"traffic"`, `"spend"`, `"performance"`, `"quality"`, `"optimization"`,
		`"tokenComposition"`, `"trend"`, `"trendBusiest"`, `"distribution"`,
		`"distributionTotalRequests"`, `"distributionActiveProviders"`,
		`"providerAccounting"`, `"modelAccounting"`, `"recentRequests"`,
		`"costMicros"`, `"valueSavedMicros"`, `"tokensSaved"`, `"regularInput"`,
		`"cacheRead"`, `"cacheWrite"`, `"requestCacheHits"`, `"successRate"`,
		`"avgLatencyMs"`, `"ttftMs"`, `"tokensPerRequest"`, `"requestsCoverage"`,
		`"tokensCoverage"`, `"savedLabel"`, `"promptReducedBytes"`, `"upstreamMs"`,
		`"inputCacheRead"`, `"inputCacheWrite"`, `"reasoningTokens"`,
		`"pricingRates"`, `"hasPricingKey"`, `"pricingEligible"`, `"cacheReadTokens"`,
		`"requestShare"`, `"tokenShare"`, `"successPct"`, `"latencyMs"`, `"ttftMs"`,
		`"costNote"`, `"failed"`,
	} {
		if !bytes.Contains(encoded, []byte(key)) {
			t.Errorf("telemetry JSON is missing %s", key)
		}
	}
}
