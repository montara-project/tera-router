package handlers

import (
	"context"
	"fmt"
	"sort"
	"strings"
	"time"

	"tera-router/server/internal/catalog"
	"tera-router/server/internal/dtos"
	"tera-router/server/internal/models"
	"tera-router/server/internal/repositories"

	"github.com/gofiber/fiber/v3"
)

// recentRequestLimit is how many rows the recent-requests table shows before
// its own client-side pagination.
const recentRequestLimit = 50

// Telemetry returns the full Usage page payload for the requested range.
func (h *usageHandler) Telemetry(c fiber.Ctx) error {
	telemetry, err := h.buildTelemetry(c.Context(), rangeStart(c.Query("range", "30d")))
	if err != nil {
		return err
	}
	return dtos.OK(c, telemetry)
}

// buildTelemetry assembles the page payload from the usage aggregates.
func (h *usageHandler) buildTelemetry(ctx context.Context, from time.Time) (dtos.UsageTelemetry, error) {
	traffic, err := h.app.Repos.Usage.Traffic(ctx, from)
	if err != nil {
		return dtos.UsageTelemetry{}, err
	}
	performance, err := h.app.Repos.Usage.Performance(ctx, from)
	if err != nil {
		return dtos.UsageTelemetry{}, err
	}
	byProvider, err := h.app.Repos.Usage.ByProvider(ctx, from)
	if err != nil {
		return dtos.UsageTelemetry{}, err
	}
	byModel, err := h.app.Repos.Usage.ByModelGrouped(ctx, from)
	if err != nil {
		return dtos.UsageTelemetry{}, err
	}
	daily, err := h.app.Repos.Usage.DailyWithFailures(ctx, from)
	if err != nil {
		return dtos.UsageTelemetry{}, err
	}
	recent, err := h.app.Repos.Usage.Recent(ctx, recentRequestLimit)
	if err != nil {
		return dtos.UsageTelemetry{}, err
	}
	overrides, err := h.app.Repos.Pricing.List(ctx, "")
	if err != nil {
		return dtos.UsageTelemetry{}, err
	}
	names, err := h.providerNames(ctx)
	if err != nil {
		return dtos.UsageTelemetry{}, err
	}

	rates := make(map[string]models.PricingOverride, len(overrides))
	for _, o := range overrides {
		rates[pricingKey(o.Provider, o.Model)] = o
	}

	// Standard input is the prompt minus the two cache classes, so the three
	// input buckets partition the prompt exactly.
	standardInput := traffic.PromptTokens - traffic.CachedTokens - traffic.CacheWriteTokens
	if standardInput < 0 {
		standardInput = 0
	}
	totalTokens := traffic.PromptTokens + traffic.CompletionTokens

	pricedTokens := int64(0)
	pricedRequests := int64(0)
	unpricedModels := 0
	for _, g := range byModel {
		if _, ok := rates[pricingKey(g.Provider, g.Model)]; ok {
			pricedTokens += g.PromptTokens + g.CompletionTokens
			pricedRequests += g.Requests
			continue
		}
		if g.Requests > 0 {
			unpricedModels++
		}
	}

	success := traffic.Requests - traffic.Failed
	if success < 0 {
		success = 0
	}

	out := dtos.UsageTelemetry{
		Traffic: dtos.UsageTelemetryTraffic{
			Requests:     traffic.Requests,
			Success:      success,
			Failed:       traffic.Failed,
			InputTokens:  standardInput,
			OutputTokens: traffic.CompletionTokens,
		},
		Spend: dtos.UsageTelemetrySpend{CostMicros: totalCost(byProvider)},
		Performance: dtos.UsageTelemetryPerformance{
			SuccessRate:      percent(success, traffic.Requests),
			AvgLatencyMs:     performance.AvgMS,
			TTFTMs:           performance.TTFTMS,
			TokensPerRequest: divide(totalTokens, traffic.Requests),
		},
		Quality: dtos.UsageTelemetryQuality{
			RequestsCoverage: percent(pricedRequests, traffic.Requests),
			TokensCoverage:   percent(pricedTokens, totalTokens),
			Notes:            unpricedModels,
			UnpricedRequests: traffic.Requests - pricedRequests,
			UnpricedModels:   unpricedModels,
		},
		// No token-saving or compression layer is enabled in this deployment,
		// so there is nothing to attribute as saved.
		Optimization: dtos.UsageTelemetryOptimization{SavedLabel: "$0.00"},
		TokenComposition: dtos.UsageTelemetryTokens{
			RegularInput:     standardInput,
			CacheRead:        traffic.CachedTokens,
			CacheWrite:       traffic.CacheWriteTokens,
			Output:           traffic.CompletionTokens,
			Reasoning:        traffic.ReasoningTokens,
			RequestCacheHits: traffic.CacheHits,
		},
		DistributionTot:  traffic.Requests,
		DistributionProv: len(byProvider),
		Trend:            trendPoints(daily),
		TrendBusiest:     busiestDay(daily),
		Distribution:     distribution(byProvider, traffic.Requests, totalTokens),
		ProviderRows:     providerRows(byProvider, rates, names),
		ModelRows:        modelRows(byModel, rates),
		RecentRequests:   requestRows(recent, rates, time.Now()),
	}
	return out, nil
}

// totalCost sums the recorded cost across the provider aggregation, so the
// spend figure the page shows is exactly the sum of the rows it lists.
func totalCost(groups []repositories.UsageGroup) int64 {
	var total int64
	for _, g := range groups {
		total += g.CostMicros
	}
	return total
}

// providerNames maps a provider slug to the display name the dashboard uses:
// the catalog name for built-in providers, the operator-supplied name for
// custom ones, and the slug itself when the provider is unknown (a deleted or
// renamed registration whose historical rows remain).
func (h *usageHandler) providerNames(ctx context.Context) (map[string]string, error) {
	names := map[string]string{}
	for _, spec := range catalog.All() {
		names[spec.Slug] = spec.Name
	}

	custom, err := h.app.Repos.Providers.List(ctx)
	if err != nil {
		return nil, err
	}
	for _, p := range custom {
		names[p.Slug] = p.Name
	}
	return names, nil
}

// providerRows builds the provider accounting table.
func providerRows(groups []repositories.UsageGroup, rates map[string]models.PricingOverride, names map[string]string) []dtos.UsageTelemetryProviderRow {
	out := make([]dtos.UsageTelemetryProviderRow, 0, len(groups))
	for _, g := range groups {
		priced := 0
		if hasPricing(rates, g.Provider, g.Model) {
			priced = int(g.Requests)
		}
		out = append(out, dtos.UsageTelemetryProviderRow{
			ID:               "pa-" + g.Provider,
			Provider:         providerDisplayName(names, g.Provider),
			Slug:             g.Provider,
			Requests:         g.Requests,
			Failed:           g.Failed,
			SuccessPct:       percent(g.Requests-g.Failed, g.Requests),
			InputTokens:      standardInput(g),
			CacheReadTokens:  g.CachedTokens,
			CacheWriteTokens: g.CacheWriteTokens,
			OutputTokens:     g.CompletionTokens,
			ReasoningTokens:  g.ReasoningTokens,
			CostMicros:       g.CostMicros,
			LatencyMs:        g.AvgLatencyMS,
			TTFTMs:           g.AvgTTFTMS,
			Coverage:         percent(int64(priced), g.Requests),
			PricingEligible:  g.Requests,
			PricingEst:       int64(priced),
			UsageEst:         g.Requests,
		})
	}
	return out
}

// modelRows builds the model accounting table. CostMicros stays null for a
// model without a pricing override so the table renders "Unpriced" instead of
// claiming the requests were free.
func modelRows(groups []repositories.UsageGroup, rates map[string]models.PricingOverride) []dtos.UsageTelemetryModelRow {
	out := make([]dtos.UsageTelemetryModelRow, 0, len(groups))
	for _, g := range groups {
		override, priced := rates[pricingKey(g.Provider, g.Model)]
		row := dtos.UsageTelemetryModelRow{
			ID:              g.Provider + "/" + g.Model,
			Model:           g.Model,
			Provider:        g.Provider,
			Requests:        g.Requests,
			SuccessPct:      percent(g.Requests-g.Failed, g.Requests),
			InputTokens:     standardInput(g),
			OutputTokens:    g.CompletionTokens,
			CachedTokens:    g.CachedTokens,
			ReasoningTokens: g.ReasoningTokens,
			LatencyMs:       g.AvgLatencyMS,
			TTFTMs:          g.AvgTTFTMS,
			HasPricingKey:   priced,
			PricingEligible: g.Requests,
			UsageEst:        g.Requests,
		}
		if priced {
			row.CostMicros = new(g.CostMicros)
			row.PricingEst = g.Requests
			row.Coverage = 100
			row.PricingRates = new(formatRates(override))
		}
		out = append(out, row)
	}
	return out
}

// formatRates renders a pricing override the way the table shows it:
// "$0.435 in · $0.003625 cache read · $0.87 out", omitting zero buckets.
func formatRates(o models.PricingOverride) string {
	parts := []string{fmt.Sprintf("$%s in", dollars(o.InputMicros))}
	if o.CacheReadMicros != 0 {
		parts = append(parts, fmt.Sprintf("$%s cache read", dollars(o.CacheReadMicros)))
	}
	if o.CacheWriteMicros != 0 {
		parts = append(parts, fmt.Sprintf("$%s cache write", dollars(o.CacheWriteMicros)))
	}
	parts = append(parts, fmt.Sprintf("$%s out", dollars(o.OutputMicros)))
	return strings.Join(parts, " · ")
}

// dollars renders micros-per-million-tokens as a per-million price, trimming
// trailing zeros so both 0.435 and 0.003625 read naturally.
func dollars(micros int64) string {
	s := fmt.Sprintf("%.6f", float64(micros)/1_000_000)
	s = strings.TrimRight(s, "0")
	return strings.TrimSuffix(s, ".")
}

// distribution builds the provider distribution slices.
func distribution(groups []repositories.UsageGroup, totalRequests, totalTokens int64) []dtos.UsageTelemetryProvider {
	out := make([]dtos.UsageTelemetryProvider, 0, len(groups))
	for _, g := range groups {
		tokens := g.PromptTokens + g.CompletionTokens
		out = append(out, dtos.UsageTelemetryProvider{
			Provider:     g.Provider,
			Requests:     g.Requests,
			RequestShare: percent(g.Requests, totalRequests),
			TokenShare:   percent(tokens, totalTokens),
		})
	}
	sort.SliceStable(out, func(i, j int) bool { return out[i].Requests > out[j].Requests })
	return out
}

// trendPoints converts the daily aggregates into the chart series, formatting
// each day as the axis label the chart expects ("Sep 07").
func trendPoints(daily []repositories.UsageDailyWithFailures) []dtos.UsageTelemetryTrendPoint {
	out := make([]dtos.UsageTelemetryTrendPoint, 0, len(daily))
	for _, d := range daily {
		out = append(out, dtos.UsageTelemetryTrendPoint{
			Day:        dayLabel(d.Day),
			Requests:   d.Requests,
			Tokens:     d.Tokens,
			CostMicros: d.CostMicros,
			Failures:   d.Failed,
		})
	}
	return out
}

// busiestDay names the day with the most requests, or "" when the window is
// empty.
func busiestDay(daily []repositories.UsageDailyWithFailures) string {
	best := ""
	var bestRequests int64 = -1
	for _, d := range daily {
		if d.Requests > bestRequests {
			best, bestRequests = d.Day, d.Requests
		}
	}
	if best == "" {
		return ""
	}
	return dayLabel(best)
}

// dayLabel reformats a "2006-01-02" bucket as "Jan 02" for display.
func dayLabel(day string) string {
	parsed, err := time.Parse("2006-01-02", day)
	if err != nil {
		return day
	}
	return parsed.Format("Jan 02")
}

// requestRows builds the recent-requests table from the stored rows. A failed
// attempt produced no tokens and therefore no billable usage, so its cost is
// reported as null with an explanatory note rather than as a free request; the
// same applies to a successful request on a model with no pricing override.
func requestRows(records []models.UsageRecord, rates map[string]models.PricingOverride, now time.Time) []dtos.UsageTelemetryRequestRow {
	out := make([]dtos.UsageTelemetryRequestRow, 0, len(records))
	for _, u := range records {
		row := dtos.UsageTelemetryRequestRow{
			ID:              fmt.Sprintf("%d", u.ID),
			Status:          "success",
			Usage:           "none",
			Model:           u.Model,
			Provider:        u.Provider,
			InputTokens:     standardInputRecord(u),
			InputCacheRead:  int64(u.CachedTokens),
			InputCacheWrite: int64(u.CacheWriteTokens),
			OutputTokens:    int64(u.CompletionTokens),
			ReasoningTokens: int64(u.ReasoningTokens),
			// Only the total latency is recorded; upstream time is not split
			// out, so the row reports the same figure for both.
			LatencyMs:  int64(u.LatencyMS),
			UpstreamMs: int64(u.LatencyMS),
			Time:       relativeTime(u.CreatedAt, now),
		}
		if u.Failed {
			row.Status = "failed"
			row.CostNote = new("No billable usage")
		} else if u.PromptTokens+u.CompletionTokens > 0 {
			row.Usage = "provider"
		}
		if !u.Failed && hasPricing(rates, u.Provider, u.Model) {
			row.CostMicros = new(u.CostMicros)
		}
		out = append(out, row)
	}
	return out
}

// standardInput returns the uncached input tokens of a group.
func standardInput(g repositories.UsageGroup) int64 {
	return standardInputParts(g.PromptTokens, g.CachedTokens, g.CacheWriteTokens)
}

// standardInputRecord returns the uncached input tokens of one stored request.
func standardInputRecord(u models.UsageRecord) int64 {
	return standardInputParts(int64(u.PromptTokens), int64(u.CachedTokens), int64(u.CacheWriteTokens))
}

func standardInputParts(prompt, cached, cacheWrite int64) int64 {
	standard := prompt - cached - cacheWrite
	if standard < 0 {
		return 0
	}
	return standard
}

func hasPricing(rates map[string]models.PricingOverride, provider, model string) bool {
	_, ok := rates[pricingKey(provider, model)]
	return ok
}

func pricingKey(provider, model string) string {
	return provider + "\x00" + model
}

func providerDisplayName(names map[string]string, slug string) string {
	if name, ok := names[slug]; ok && name != "" {
		return name
	}
	return slug
}

// percent returns value/total as a percentage rounded to one decimal.
func percent(value, total int64) float64 {
	if total <= 0 {
		return 0
	}
	return float64(int64(float64(value)/float64(total)*1000+0.5)) / 10
}

// divide returns value/total, or 0 for an empty total.
func divide(value, total int64) int64 {
	if total <= 0 {
		return 0
	}
	return value / total
}

// relativeTime renders how long ago a request ran, matching the compact form
// the recent-requests table shows.
func relativeTime(t, now time.Time) string {
	if t.IsZero() {
		return ""
	}
	d := now.Sub(t)
	switch {
	case d < time.Minute:
		return "just now"
	case d < time.Hour:
		return fmt.Sprintf("%dm ago", int(d.Minutes()))
	case d < 24*time.Hour:
		return fmt.Sprintf("%dh ago", int(d.Hours()))
	default:
		return fmt.Sprintf("%dd ago", int(d.Hours()/24))
	}
}
