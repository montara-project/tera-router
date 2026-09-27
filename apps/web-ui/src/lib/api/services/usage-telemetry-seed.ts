import type { UsageTelemetryOverview } from '../models/usage'

// Seed mirrors the KeiRouter reference telemetry. TODO: once the backend
// exposes these fields, merge them from `/v1/usage/summary` and
// `/v1/usage/insights` and drop this seed.

function buildTrend(): UsageTelemetryOverview['trend'] {
  const days = [
    'Aug 29', 'Aug 30', 'Aug 31', 'Sep 01', 'Sep 02', 'Sep 03', 'Sep 04',
    'Sep 05', 'Sep 06', 'Sep 07', 'Sep 08', 'Sep 09', 'Sep 10', 'Sep 11',
    'Sep 12', 'Sep 13', 'Sep 14', 'Sep 15', 'Sep 16', 'Sep 17', 'Sep 18',
    'Sep 19', 'Sep 20', 'Sep 21', 'Sep 22', 'Sep 23', 'Sep 24', 'Sep 25', 'Sep 26',
  ]

  return days.map((day, index) => {
    const requests = day === 'Sep 07' ? 592 : Math.round((index % 4) * 7 + (index % 3) * 3)
    return {
      day,
      requests,
      tokens: requests * 39_300,
      costMicros: requests * 9_200,
      failures: day === 'Sep 07' ? 21 : index % 3,
    }
  })
}

function buildRecentRequests(): UsageTelemetryOverview['recentRequests'] {
  const base: Array<Partial<UsageTelemetryOverview['recentRequests'][number]> & { inputTokens: number }> = [
    { status: 'cancelled', usage: 'none', inputTokens: 0, costMicros: 0, costNote: 'No billable usage', latencyMs: 124_900, upstreamMs: 124_910 },
    { status: 'success', usage: 'provider', inputTokens: 19_139, outputTokens: 459, latencyMs: 17_620, upstreamMs: 17_520 },
    { status: 'success', usage: 'provider', inputTokens: 18_805, outputTokens: 6_838, latencyMs: 184_350, upstreamMs: 184_250 },
    { status: 'success', usage: 'provider', inputTokens: 18_485, outputTokens: 170, reasoningTokens: 67, latencyMs: 12_590, upstreamMs: 12_490 },
    { status: 'success', usage: 'provider', inputTokens: 268, outputTokens: 367, latencyMs: 9_880, upstreamMs: 9_870 },
    { status: 'cancelled', usage: 'estimate', inputTokens: 18_976, latencyMs: 7_840, upstreamMs: 7_790 },
    { status: 'success', usage: 'provider', inputTokens: 20_106, inputCacheRead: 19_136, outputTokens: 42, latencyMs: 5_140, upstreamMs: 5_090 },
    { status: 'success', usage: 'provider', inputTokens: 19_870, outputTokens: 119, latencyMs: 11_700, upstreamMs: 11_650 },
    { status: 'success', usage: 'provider', inputTokens: 17_839, inputCacheRead: 7_488, outputTokens: 8, latencyMs: 6_550, upstreamMs: 6_550 },
    { status: 'success', usage: 'provider', inputTokens: 19_174, inputCacheRead: 11_328, outputTokens: 193, reasoningTokens: 12, latencyMs: 11_140, upstreamMs: 11_090 },
    { status: 'success', usage: 'provider', inputTokens: 18_757, outputTokens: 260, latencyMs: 11_010, upstreamMs: 10_950 },
    { status: 'success', usage: 'provider', inputTokens: 12_095, inputCacheRead: 11_328, outputTokens: 142, reasoningTokens: 35, latencyMs: 8_290, upstreamMs: 8_240 },
  ]

  const providers = ['CUSTOM-OPENAI-CHEAPER-INFERENCE', 'CUSTOM-OPENAI-KENARI']
  const rows: UsageTelemetryOverview['recentRequests'] = []

  for (let i = 0; i < 50; i++) {
    const base_ = base[i % base.length]
    rows.push({
      id: `utr-${i + 1}`,
      status: base_.status ?? 'success',
      usage: base_.usage ?? 'provider',
      model: 'glm-5.3-flash',
      provider: providers[i % providers.length],
      inputTokens: base_.inputTokens,
      inputCacheRead: base_.inputCacheRead ?? 0,
      inputCacheWrite: base_.inputCacheWrite ?? 0,
      outputTokens: base_.outputTokens ?? 0,
      reasoningTokens: base_.reasoningTokens ?? 0,
      costMicros: base_.costMicros ?? null,
      costNote: base_.costNote ?? null,
      latencyMs: base_.latencyMs ?? 0,
      upstreamMs: base_.upstreamMs ?? 0,
      time: '19d ago',
    })
  }

  return rows
}

export const USAGE_TELEMETRY_SEED: UsageTelemetryOverview = {
  traffic: {
    requests: 561,
    success: 540,
    failed: 21,
    inputTokens: 21_400_000,
    outputTokens: 662_900,
  },
  spend: {
    costMicros: 5_140_000,
    valueSavedMicros: 4_300,
    tokensSaved: 248_300,
  },
  performance: {
    successRate: 96.3,
    avgLatencyMs: 22_600,
    ttftMs: 7_450,
    tokensPerRequest: 39_300,
  },
  quality: { requestsCoverage: 79.7, tokensCoverage: 76.4, notes: 3 },
  optimization: {
    savedLabel: '<$0.01',
    tokensSaved: 248_300,
    optimizedRequests: 250,
    promptReducedBytes: 970_000,
  },
  trend: buildTrend(),
  trendBusiest: 'Sep 07',
  distribution: [
    { provider: 'custom-openai-cheaper-inference', requests: 172, requestShare: 30.7, tokenShare: 31.7 },
    { provider: 'custom-openai-kenari', requests: 160, requestShare: 26.5, tokenShare: 28.5 },
    { provider: 'custom-openai-teamorouter', requests: 130, requestShare: 23.2, tokenShare: 22.5 },
    { provider: 'Gonka', requests: 35, requestShare: 6.2, tokenShare: 6.2 },
    { provider: 'ID QZZ', requests: 30, requestShare: 5.3, tokenShare: 9.9 },
    { provider: 'Vyce AI', requests: 17, requestShare: 3.0, tokenShare: 2.0 },
  ],
  distributionTotalRequests: 561,
  distributionActiveProviders: 8,
  providerAccounting: [
    {
      id: 'pa-1', provider: 'custom-openai-cheaper-inference', slug: 'custom-openai-cheaper-inference',
      requests: 172, failed: 2, successPct: 98.8,
      inputTokens: 6_700_000, cacheReadTokens: 3_000_000, cacheWriteTokens: 0,
      outputTokens: 262_200, reasoningTokens: 143_100,
      costMicros: 1_700_000, savedMicros: 1_300, latencyMs: 21_970, ttftMs: 6_280,
      coverage: 93.6, pricingEligible: 160, pricingEst: 160, usageEst: 1, legacy: 0, backfilled: 0,
    },
    {
      id: 'pa-2', provider: 'custom-openai-kenari', slug: 'custom-openai-kenari',
      requests: 160, failed: 4, successPct: 97.5,
      inputTokens: 5_700_000, cacheReadTokens: 531_100, cacheWriteTokens: 0,
      outputTokens: 163_300, reasoningTokens: 0,
      costMicros: 2_140_000, savedMicros: 1_400, latencyMs: 15_930, ttftMs: 6_370,
      coverage: 84.4, pricingEligible: 135, pricingEst: 135, usageEst: 1, legacy: 0, backfilled: 0,
    },
    {
      id: 'pa-3', provider: 'custom-openai-teamorouter', slug: 'custom-openai-teamorouter',
      requests: 130, failed: 4, successPct: 96.9,
      inputTokens: 4_800_000, cacheReadTokens: 2_200_000, cacheWriteTokens: 0,
      outputTokens: 185_900, reasoningTokens: 80_900,
      costMicros: 1_120_000, savedMicros: 1_500, latencyMs: 19_670, ttftMs: 5_310,
      coverage: 92.2, pricingEligible: 119, pricingEst: 119, usageEst: 3, legacy: 0, backfilled: 0,
    },
    {
      id: 'pa-4', provider: 'Gonka', slug: 'custom-openai-gonka',
      requests: 35, failed: 4, successPct: 88.6,
      inputTokens: 1_400_000, cacheReadTokens: 0, cacheWriteTokens: 0,
      outputTokens: 8_700, reasoningTokens: 0,
      costMicros: 0, savedMicros: 0, latencyMs: 62_160, ttftMs: 32_390,
      coverage: 0.0, pricingEligible: 33, pricingEst: 0, usageEst: 1, legacy: 0, backfilled: 0,
    },
    {
      id: 'pa-5', provider: 'ID QZZ', slug: 'custom-openai-id-qzz',
      requests: 30, failed: 2, successPct: 93.3,
      inputTokens: 2_100_000, cacheReadTokens: 0, cacheWriteTokens: 0,
      outputTokens: 37_100, reasoningTokens: 6_300,
      costMicros: 0, savedMicros: 0, latencyMs: 39_440, ttftMs: 8_320,
      coverage: 0.0, pricingEligible: 30, pricingEst: 0, usageEst: 6, legacy: 0, backfilled: 0,
    },
    {
      id: 'pa-6', provider: 'Vyce AI', slug: 'custom-openai-vyce-ai',
      requests: 17, failed: 5, successPct: 70.6,
      inputTokens: 434_000, cacheReadTokens: 0, cacheWriteTokens: 0,
      outputTokens: 1_000, reasoningTokens: 0,
      costMicros: 64_900, savedMicros: 0, latencyMs: 19_370, ttftMs: 5_840,
      coverage: 100.0, pricingEligible: 12, pricingEst: 12, usageEst: 12, legacy: 0, backfilled: 0,
    },
    {
      id: 'pa-7', provider: 'Custom (OpenAI-compatible)', slug: 'custom-openai',
      requests: 14, failed: 0, successPct: 100.0,
      inputTokens: 236_600, cacheReadTokens: 0, cacheWriteTokens: 0,
      outputTokens: 3_600, reasoningTokens: 0,
      costMicros: 106_000, savedMicros: 0, latencyMs: 6_690, ttftMs: 4_160,
      coverage: 100.0, pricingEligible: 14, pricingEst: 14, usageEst: 0, legacy: 0, backfilled: 0,
    },
    {
      id: 'pa-8', provider: 'OrcaRouter', slug: 'custom-openai-orcarouter',
      requests: 3, failed: 0, successPct: 100.0,
      inputTokens: 42_900, cacheReadTokens: 20_500, cacheWriteTokens: 0,
      outputTokens: 1_100, reasoningTokens: 867,
      costMicros: 0, savedMicros: 0, latencyMs: 4_050, ttftMs: 1_500,
      coverage: 0.0, pricingEligible: 3, pricingEst: 0, usageEst: 0, legacy: 0, backfilled: 0,
    },
  ],
  modelAccounting: [
    {
      id: 'ma-1', model: 'deepseek-v4-pro', provider: 'CUSTOM-OPENAI-KENARI',
      requests: 135, successPct: 98.5,
      inputTokens: 4_900_000, outputTokens: 185_500, cachedTokens: 319_900, reasoningTokens: 0,
      costMicros: 2_140_000, savedMicros: 1_400, latencyMs: 15_080, ttftMs: 6_180,
      coverage: 100.0, pricingEligible: 135, pricingEst: 135, usageEst: 0, legacy: 0, backfilled: 0,
      hasPricingKey: true,
      pricingRates: 'deepseek/deepseek-v4-pro — $0.435 in · $0.003625 cache · $0.87 out',
    },
    {
      id: 'ma-2', model: 'deepseek-v4-pro', provider: 'CUSTOM-OPENAI-CHEAPER-INFERENCE',
      requests: 160, successPct: 99.4,
      inputTokens: 6_300_000, outputTokens: 259_600, cachedTokens: 3_000_000, reasoningTokens: 142_300,
      costMicros: 1_700_000, savedMicros: 1_300, latencyMs: 21_820, ttftMs: 6_490,
      coverage: 100.0, pricingEligible: 160, pricingEst: 160, usageEst: 1, legacy: 0, backfilled: 0,
      hasPricingKey: true,
      pricingRates: 'deepseek/deepseek-v4-pro — $0.435 in · $0.003625 cache · $0.87 out',
    },
    {
      id: 'ma-3', model: 'deepseek-v4-pro', provider: 'CUSTOM-OPENAI-TEAMOROUTER',
      requests: 119, successPct: 97.5,
      inputTokens: 4_300_000, outputTokens: 180_400, cachedTokens: 2_100_000, reasoningTokens: 77_600,
      costMicros: 1_120_000, savedMicros: 1_500, latencyMs: 20_030, ttftMs: 5_160,
      coverage: 100.0, pricingEligible: 119, pricingEst: 119, usageEst: 3, legacy: 0, backfilled: 0,
      hasPricingKey: true,
      pricingRates: 'deepseek/deepseek-v4-pro — $0.435 in · $0.003625 cache · $0.87 out',
    },
    {
      id: 'ma-4', model: 'deepseek-v4-pro', provider: 'CUSTOM (OPENAI-COMPATIBLE)',
      requests: 14, successPct: 100.0,
      inputTokens: 236_600, outputTokens: 3_600, cachedTokens: 0, reasoningTokens: 0,
      costMicros: 106_000, savedMicros: 0, latencyMs: 6_690, ttftMs: 4_160,
      coverage: 100.0, pricingEligible: 14, pricingEst: 14, usageEst: 0, legacy: 0, backfilled: 0,
      hasPricingKey: true,
      pricingRates: 'deepseek/deepseek-v4-pro — $0.435 in · $0.003625 cache · $0.87 out',
    },
    {
      id: 'ma-5', model: 'deepseek-v4-flash', provider: 'VYCE AI',
      requests: 11, successPct: 100.0,
      inputTokens: 433_800, outputTokens: 804, cachedTokens: 0, reasoningTokens: 0,
      costMicros: 61_000, savedMicros: 0, latencyMs: 17_440, ttftMs: 5_190,
      coverage: 100.0, pricingEligible: 11, pricingEst: 11, usageEst: 0, legacy: 0, backfilled: 0,
      hasPricingKey: true,
      pricingRates: 'deepseek/deepseek-v4-flash — $0.14 in · $0.0025 cache · $0.28 out',
    },
    {
      id: 'ma-6', model: 'claude-sonnet-4-6', provider: 'VYCE AI',
      requests: 6, successPct: 16.7,
      inputTokens: 226, outputTokens: 220, cachedTokens: 0, reasoningTokens: 0,
      costMicros: 4_000, savedMicros: 0, latencyMs: 22_910, ttftMs: 13_050,
      coverage: 100.0, pricingEligible: 1, pricingEst: 1, usageEst: 0, legacy: 0, backfilled: 0,
      hasPricingKey: true,
      pricingRates: 'anthropics/claude-sonnet-4-6 — $3 in · $0.375 cache · $15 out',
    },
    {
      id: 'ma-7', model: 'deepseek-ai/DeepSeek-V4-Flash-0731', provider: 'GONKA',
      requests: 35, successPct: 88.6,
      inputTokens: 1_400_000, outputTokens: 8_700, cachedTokens: 0, reasoningTokens: 0,
      costMicros: null, savedMicros: 0, latencyMs: 62_160, ttftMs: 32_390,
      coverage: 0.0, pricingEligible: 33, pricingEst: 0, usageEst: 1, legacy: 0, backfilled: 0,
      hasPricingKey: false, pricingRates: null,
    },
    {
      id: 'ma-8', model: 'glm-5.3-flash', provider: 'ID QZZ',
      requests: 30, successPct: 93.3,
      inputTokens: 2_100_000, outputTokens: 37_100, cachedTokens: 0, reasoningTokens: 6_300,
      costMicros: null, savedMicros: 0, latencyMs: 39_440, ttftMs: 8_320,
      coverage: 0.0, pricingEligible: 30, pricingEst: 0, usageEst: 6, legacy: 0, backfilled: 0,
      hasPricingKey: false, pricingRates: null,
    },
    {
      id: 'ma-9', model: 'glm-5.3-flash', provider: 'CUSTOM-OPENAI-KENARI',
      requests: 25, successPct: 92.0,
      inputTokens: 733_700, outputTokens: 13_800, cachedTokens: 212_200, reasoningTokens: 0,
      costMicros: null, savedMicros: 0, latencyMs: 20_490, ttftMs: 7_470,
      coverage: 0.0, pricingEligible: 25, pricingEst: 0, usageEst: 1, legacy: 0, backfilled: 0,
      hasPricingKey: false, pricingRates: null,
    },
    {
      id: 'ma-10', model: 'glm-5.3-flash', provider: 'CUSTOM-OPENAI-CHEAPER-INFERENCE',
      requests: 12, successPct: 91.7,
      inputTokens: 354_100, outputTokens: 2_600, cachedTokens: 52_200, reasoningTokens: 790,
      costMicros: null, savedMicros: 0, latencyMs: 23_960, ttftMs: 14_120,
      coverage: 0.0, pricingEligible: 11, pricingEst: 0, usageEst: 1, legacy: 0, backfilled: 0,
      hasPricingKey: false, pricingRates: null,
    },
    {
      id: 'ma-11', model: 'gpt-4o', provider: 'CUSTOM-OPENAI',
      requests: 8, successPct: 100.0,
      inputTokens: 96_400, outputTokens: 5_200, cachedTokens: 0, reasoningTokens: 0,
      costMicros: 82_000, savedMicros: 0, latencyMs: 5_940, ttftMs: 2_310,
      coverage: 100.0, pricingEligible: 8, pricingEst: 8, usageEst: 0, legacy: 0, backfilled: 0,
      hasPricingKey: true,
      pricingRates: 'openai/gpt-4o — $2.50 in · $1.25 cache · $10 out',
    },
    {
      id: 'ma-12', model: 'gpt-4o-mini', provider: 'CUSTOM-OPENAI',
      requests: 5, successPct: 100.0,
      inputTokens: 41_300, outputTokens: 1_900, cachedTokens: 0, reasoningTokens: 0,
      costMicros: 6_400, savedMicros: 0, latencyMs: 4_120, ttftMs: 1_880,
      coverage: 100.0, pricingEligible: 5, pricingEst: 5, usageEst: 0, legacy: 0, backfilled: 0,
      hasPricingKey: true,
      pricingRates: 'openai/gpt-4o-mini — $0.15 in · $0.075 cache · $0.60 out',
    },
    {
      id: 'ma-13', model: 'gemini-2.0-flash', provider: 'CUSTOM-OPENAI-TEAMOROUTER',
      requests: 4, successPct: 75.0,
      inputTokens: 88_100, outputTokens: 2_400, cachedTokens: 0, reasoningTokens: 0,
      costMicros: null, savedMicros: 0, latencyMs: 12_310, ttftMs: 3_940,
      coverage: 0.0, pricingEligible: 4, pricingEst: 0, usageEst: 2, legacy: 0, backfilled: 0,
      hasPricingKey: false, pricingRates: null,
    },
  ],
  recentRequests: buildRecentRequests(),
}
