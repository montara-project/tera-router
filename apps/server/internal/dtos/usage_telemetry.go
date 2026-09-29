package dtos

// UsageTelemetry is the payload of GET /v1/usage/telemetry, the single read
// behind the Usage page.
//
// Unlike the rest of this package (which speaks the snake_case wire convention
// of the Go models), these fields are camelCase because the web UI consumes
// this shape verbatim: it is the telemetry contract the page's components and
// types were written against.
//
// Token conventions used throughout:
//   - InputTokens is the *uncached* input: prompt tokens minus the tokens read
//     from and written to a provider-side cache. CacheReadTokens and
//     CacheWriteTokens are the other two input classes, so the three of them
//     partition the prompt exactly and never double count.
//   - ReasoningTokens is a subset of the output tokens, reported separately for
//     visibility.
type UsageTelemetry struct {
	Traffic          UsageTelemetryTraffic       `json:"traffic"`
	Spend            UsageTelemetrySpend         `json:"spend"`
	Performance      UsageTelemetryPerformance   `json:"performance"`
	Quality          UsageTelemetryQuality       `json:"quality"`
	Optimization     UsageTelemetryOptimization  `json:"optimization"`
	TokenComposition UsageTelemetryTokens        `json:"tokenComposition"`
	Trend            []UsageTelemetryTrendPoint  `json:"trend"`
	TrendBusiest     string                      `json:"trendBusiest"`
	Distribution     []UsageTelemetryProvider    `json:"distribution"`
	DistributionTot  int64                       `json:"distributionTotalRequests"`
	DistributionProv int                         `json:"distributionActiveProviders"`
	ProviderRows     []UsageTelemetryProviderRow `json:"providerAccounting"`
	ModelRows        []UsageTelemetryModelRow    `json:"modelAccounting"`
	RecentRequests   []UsageTelemetryRequestRow  `json:"recentRequests"`
}

// UsageTelemetryTraffic totals the requests in the window.
type UsageTelemetryTraffic struct {
	Requests     int64 `json:"requests"`
	Success      int64 `json:"success"`
	Failed       int64 `json:"failed"`
	InputTokens  int64 `json:"inputTokens"`
	OutputTokens int64 `json:"outputTokens"`
}

// UsageTelemetrySpend reports recorded cost. The savings fields stay zero:
// this deployment has no token-optimization subsystem, so there is nothing
// saved to attribute.
type UsageTelemetrySpend struct {
	CostMicros       int64 `json:"costMicros"`
	ValueSavedMicros int64 `json:"valueSavedMicros"`
	TokensSaved      int64 `json:"tokensSaved"`
}

// UsageTelemetryPerformance averages over successful requests only.
type UsageTelemetryPerformance struct {
	SuccessRate      float64 `json:"successRate"`
	AvgLatencyMs     int64   `json:"avgLatencyMs"`
	TTFTMs           int64   `json:"ttftMs"`
	TokensPerRequest int64   `json:"tokensPerRequest"`
}

// UsageTelemetryQuality describes how much of the window carries a known price.
// Coverage is the share of requests (and of tokens) whose provider/model has a
// pricing override; spend totals can only be trusted for that share.
type UsageTelemetryQuality struct {
	RequestsCoverage float64 `json:"requestsCoverage"`
	TokensCoverage   float64 `json:"tokensCoverage"`
	Notes            int     `json:"notes"`
	UnpricedRequests int64   `json:"unpricedRequests"`
	UnpricedModels   int     `json:"unpricedModels"`
}

// UsageTelemetryOptimization is always empty here: no compression, caching or
// token-saving layer is enabled.
type UsageTelemetryOptimization struct {
	SavedLabel         string `json:"savedLabel"`
	TokensSaved        int64  `json:"tokensSaved"`
	OptimizedRequests  int64  `json:"optimizedRequests"`
	PromptReducedBytes int64  `json:"promptReducedBytes"`
}

// UsageTelemetryTokens is the token composition of the window.
type UsageTelemetryTokens struct {
	RegularInput     int64 `json:"regularInput"`
	CacheRead        int64 `json:"cacheRead"`
	CacheWrite       int64 `json:"cacheWrite"`
	Output           int64 `json:"output"`
	Reasoning        int64 `json:"reasoning"`
	RequestCacheHits int64 `json:"requestCacheHits"`
}

// UsageTelemetryTrendPoint is one day of the trend series. Day is formatted for
// display ("Sep 07"), matching the chart's axis labels.
type UsageTelemetryTrendPoint struct {
	Day        string `json:"day"`
	Requests   int64  `json:"requests"`
	Tokens     int64  `json:"tokens"`
	CostMicros int64  `json:"costMicros"`
	Failures   int64  `json:"failures"`
}

// UsageTelemetryProvider is one slice of the provider distribution.
type UsageTelemetryProvider struct {
	Provider     string  `json:"provider"`
	Requests     int64   `json:"requests"`
	RequestShare float64 `json:"requestShare"`
	TokenShare   float64 `json:"tokenShare"`
}

// UsageTelemetryProviderRow is one row of the provider accounting table.
type UsageTelemetryProviderRow struct {
	ID               string  `json:"id"`
	Provider         string  `json:"provider"`
	Slug             string  `json:"slug"`
	Requests         int64   `json:"requests"`
	Failed           int64   `json:"failed"`
	SuccessPct       float64 `json:"successPct"`
	InputTokens      int64   `json:"inputTokens"`
	CacheReadTokens  int64   `json:"cacheReadTokens"`
	CacheWriteTokens int64   `json:"cacheWriteTokens"`
	OutputTokens     int64   `json:"outputTokens"`
	ReasoningTokens  int64   `json:"reasoningTokens"`
	CostMicros       int64   `json:"costMicros"`
	SavedMicros      int64   `json:"savedMicros"`
	LatencyMs        int64   `json:"latencyMs"`
	TTFTMs           int64   `json:"ttftMs"`
	Coverage         float64 `json:"coverage"`
	PricingEligible  int64   `json:"pricingEligible"`
	PricingEst       int64   `json:"pricingEst"`
	UsageEst         int64   `json:"usageEst"`
	Legacy           int64   `json:"legacy"`
	Backfilled       int64   `json:"backfilled"`
}

// UsageTelemetryModelRow is one row of the model accounting table. CostMicros
// is null when the model carries no pricing override: the table renders that as
// "Unpriced" rather than as a free request.
type UsageTelemetryModelRow struct {
	ID              string  `json:"id"`
	Model           string  `json:"model"`
	Provider        string  `json:"provider"`
	Requests        int64   `json:"requests"`
	SuccessPct      float64 `json:"successPct"`
	InputTokens     int64   `json:"inputTokens"`
	OutputTokens    int64   `json:"outputTokens"`
	CachedTokens    int64   `json:"cachedTokens"`
	ReasoningTokens int64   `json:"reasoningTokens"`
	CostMicros      *int64  `json:"costMicros"`
	SavedMicros     int64   `json:"savedMicros"`
	LatencyMs       int64   `json:"latencyMs"`
	TTFTMs          int64   `json:"ttftMs"`
	Coverage        float64 `json:"coverage"`
	PricingEligible int64   `json:"pricingEligible"`
	PricingEst      int64   `json:"pricingEst"`
	UsageEst        int64   `json:"usageEst"`
	Legacy          int64   `json:"legacy"`
	Backfilled      int64   `json:"backfilled"`
	HasPricingKey   bool    `json:"hasPricingKey"`
	PricingRates    *string `json:"pricingRates"`
}

// UsageTelemetryRequestRow is one row of the recent-requests table. Status is
// "success" or "failed"; Usage is "provider" when the upstream reported tokens
// and "none" otherwise.
type UsageTelemetryRequestRow struct {
	ID              string  `json:"id"`
	Status          string  `json:"status"`
	Usage           string  `json:"usage"`
	Model           string  `json:"model"`
	Provider        string  `json:"provider"`
	InputTokens     int64   `json:"inputTokens"`
	InputCacheRead  int64   `json:"inputCacheRead"`
	InputCacheWrite int64   `json:"inputCacheWrite"`
	OutputTokens    int64   `json:"outputTokens"`
	ReasoningTokens int64   `json:"reasoningTokens"`
	CostMicros      *int64  `json:"costMicros"`
	CostNote        *string `json:"costNote"`
	LatencyMs       int64   `json:"latencyMs"`
	UpstreamMs      int64   `json:"upstreamMs"`
	Time            string  `json:"time"`
}
