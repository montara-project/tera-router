export type UsageRange = 'today' | '24h' | '7d' | '30d' | '90d'

/** One model's share of an activity day, busiest first. */
export type UsageActivityModel = {
  provider: string
  provider_name: string
  model: string
  requests: number
}

/** One UTC day with traffic in the activity calendar. */
export type UsageActivityDay = {
  day: string
  requests: number
  failed: number
  models: UsageActivityModel[]
}

/** Activity calendar: the last 53 weeks (from is a Sunday, to is today, UTC). */
export type UsageActivity = {
  from: string
  to: string
  total_requests: number
  active_days: number
  days: UsageActivityDay[]
}

export type UsageProviderAccountingRow = {
  id: string
  provider: string
  slug: string
  api_kind?: string
  requests: number
  failed: number
  successPct: number
  inputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  outputTokens: number
  reasoningTokens: number
  costMicros: number
  savedMicros: number
  latencyMs: number
  ttftMs: number
  coverage: number
  pricingEligible: number
  pricingEst: number
  usageEst: number
  legacy: number
  backfilled: number
}

export type UsageModelAccountingRow = {
  api_kind?: string
  id: string
  model: string
  provider: string
  requests: number
  successPct: number
  inputTokens: number
  outputTokens: number
  cachedTokens: number
  reasoningTokens: number
  /** null renders the Unpriced state */
  costMicros: number | null
  savedMicros: number
  latencyMs: number
  ttftMs: number
  coverage: number
  pricingEligible: number
  pricingEst: number
  usageEst: number
  legacy: number
  backfilled: number
  hasPricingKey: boolean
  pricingRates: string | null
}

export type UsageTerminalRequestRow = {
  id: string
  status: 'success' | 'failed' | 'cancelled'
  usage: 'provider' | 'estimate' | 'none'
  model: string
  provider: string
  api_kind?: string
  inputTokens: number
  inputCacheRead: number
  inputCacheWrite: number
  outputTokens: number
  reasoningTokens: number
  /** null renders Unpriced */
  costMicros: number | null
  /** 'No billable usage' style note under cost */
  costNote: string | null
  /** Budget-drain multiplier snapshotted at request time; absent = 1:1 */
  tokenConsumptionRate?: number | null
  latencyMs: number
  upstreamMs: number
  time: string
  /** Request time, RFC 3339 (UTC). */
  createdAt: string
  client: string
  /** Upstream failure class (auth, rate_limit, upstream, …); failed rows only. */
  errorKind?: string
  errorStatus?: number
}

export type UsageTelemetryOverview = {
  traffic: {
    requests: number
    success: number
    failed: number
    inputTokens: number
    outputTokens: number
  }
  spend: { costMicros: number; valueSavedMicros: number; tokensSaved: number }
  performance: {
    successRate: number
    avgLatencyMs: number
    p50Ms: number
    p95Ms: number
    ttftMs: number
    tokensPerRequest: number
  }
  quality: {
    requestsCoverage: number
    tokensCoverage: number
    notes: number
    /** Requests whose model has no pricing override, so spend excludes them */
    unpricedRequests: number
    /** Provider/model pairs in the window with no pricing override */
    unpricedModels: number
  }
  /** The same-length window just before this one, for the card deltas. */
  previous: {
    requests: number
    successRate: number
    p50Ms: number
    costMicros: number
  }
  optimization: {
    savedLabel: string
    /** Estimated at ~4 bytes per token removed by input compression. */
    tokensSaved: number
    /** Requests input compression shrank. */
    optimizedRequests: number
    promptReducedBytes: number
    /** Requests that carried an output-shaping directive. */
    shapedRequests: number
  }
  tokenComposition: {
    regularInput: number
    cacheRead: number
    cacheWrite: number
    output: number
    reasoning: number
    requestCacheHits: number
  }
  /** One point per day (per hour for today/24h); quiet buckets are zero. */
  trend: {
    day: string
    requests: number
    tokens: number
    costMicros: number
    failures: number
    /** Average latency of the bucket's successful requests. */
    latencyMs: number
  }[]
  trendBusiest: string
  distribution: {
    provider: string
    api_kind?: string
    requests: number
    requestShare: number
    tokenShare: number
  }[]
  distributionTotalRequests: number
  distributionActiveProviders: number
  providerAccounting: UsageProviderAccountingRow[]
  modelAccounting: UsageModelAccountingRow[]
  recentRequests: UsageTerminalRequestRow[]
}
