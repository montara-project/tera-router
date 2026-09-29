export type UsageRange = 'today' | '24h' | '7d' | '30d'

export type UsageSummary = {
  requests: number
  prompt_tokens: number
  completion_tokens: number
  cost_micros: number
  avg_latency_ms: number
}

export type UsageByModel = {
  provider: string
  model: string
  requests: number
  prompt_tokens: number
  completion_tokens: number
  cost_micros: number
  avg_latency_ms: number
}

export type UsageDaily = {
  day: string
  requests: number
  cost_micros: number
  tokens: number
}

export type UsageProviderAccountingRow = {
  id: string
  provider: string
  slug: string
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
  inputTokens: number
  inputCacheRead: number
  inputCacheWrite: number
  outputTokens: number
  reasoningTokens: number
  /** null renders Unpriced */
  costMicros: number | null
  /** 'No billable usage' style note under cost */
  costNote: string | null
  latencyMs: number
  upstreamMs: number
  time: string
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
  optimization: {
    savedLabel: string
    tokensSaved: number
    optimizedRequests: number
    promptReducedBytes: number
  }
  tokenComposition: {
    regularInput: number
    cacheRead: number
    cacheWrite: number
    output: number
    reasoning: number
    requestCacheHits: number
  }
  trend: { day: string; requests: number; tokens: number; costMicros: number; failures: number }[]
  trendBusiest: string
  distribution: { provider: string; requests: number; requestShare: number; tokenShare: number }[]
  distributionTotalRequests: number
  distributionActiveProviders: number
  providerAccounting: UsageProviderAccountingRow[]
  modelAccounting: UsageModelAccountingRow[]
  recentRequests: UsageTerminalRequestRow[]
}
