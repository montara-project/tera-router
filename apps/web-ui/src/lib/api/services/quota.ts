import { type AxiosItemResponse } from '@/types/api'

import type { QuotaAccount, QuotaOverview, QuotaRange, QuotaSummary } from '../models/quota'

const path = '/v1/quota'

/**
 * The quota endpoint is not available on the server yet, so this service keeps
 * an in-memory account list matching what GET /v1/quota/overview would return.
 * Active accounts gain a bit of usage on every fetch to simulate live traffic.
 */
const RANGE_SHARE: Record<QuotaRange, number> = {
  today: 1 / 30,
  '7d': 7 / 30,
  '30d': 1,
}

let accounts: QuotaAccount[] = [
  {
    id: 'acc-gonka',
    name: 'Gonka',
    provider: 'Gonka',
    authLabel: 'Dev · API key',
    initials: 'GO',
    status: 'active',
    priority: 100,
    quotaVisibility: 'usage-only',
    quotaNote: 'Provider does not expose upstream limits.',
    requests: 35,
    inputTokens: 1_300_000,
    outputTokens: 100_000,
    attributedCost: 0,
    attention: false,
    depleted: false,
  },
  {
    id: 'acc-idqzz',
    name: 'ID QZZ',
    provider: 'ID QZZ',
    authLabel: 'Dev · API key',
    initials: 'ID',
    status: 'active',
    priority: 100,
    quotaVisibility: 'usage-only',
    quotaNote: 'Provider does not expose upstream limits.',
    requests: 30,
    inputTokens: 2_100_000,
    outputTokens: 100_000,
    attributedCost: 0,
    attention: false,
    depleted: false,
  },
  {
    id: 'acc-vyce',
    name: 'Vyce AI',
    provider: 'Vyce AI',
    authLabel: 'Dev · API key',
    initials: 'VY',
    status: 'active',
    priority: 100,
    quotaVisibility: 'usage-only',
    quotaNote: 'Provider does not expose upstream limits.',
    requests: 17,
    inputTokens: 320_000,
    outputTokens: 115_100,
    attributedCost: 0.0649,
    attention: false,
    depleted: false,
  },
  {
    id: 'acc-orca',
    name: 'OrcaRouter',
    provider: 'OrcaRouter',
    authLabel: 'Dev · API key',
    initials: 'OR',
    status: 'active',
    priority: 100,
    quotaVisibility: 'usage-only',
    quotaNote: 'Provider does not expose upstream limits.',
    requests: 3,
    inputTokens: 40_000,
    outputTokens: 4_000,
    attributedCost: 0,
    attention: false,
    depleted: false,
  },
  {
    id: 'acc-codecraft',
    name: 'Code Craft API',
    provider: 'Code Craft API',
    authLabel: 'Dev · API key',
    initials: 'CO',
    status: 'active',
    priority: 100,
    quotaVisibility: 'usage-only',
    quotaNote: 'Provider does not expose upstream limits.',
    requests: 0,
    inputTokens: 0,
    outputTokens: 0,
    attributedCost: 0,
    attention: false,
    depleted: false,
  },
  {
    id: 'acc-kira',
    name: 'Kira AI',
    provider: 'Kira AI',
    authLabel: 'Dev · API key',
    initials: 'KI',
    status: 'active',
    priority: 100,
    quotaVisibility: 'usage-only',
    quotaNote: 'Provider does not expose upstream limits.',
    requests: 0,
    inputTokens: 0,
    outputTokens: 0,
    attributedCost: 0,
    attention: false,
    depleted: false,
  },
  {
    id: 'acc-mimo',
    name: 'MiMo Free',
    provider: 'MiMo Free',
    authLabel: 'MiMo Free (auto) · None',
    initials: 'Mi',
    brandAvatar: true,
    status: 'active',
    priority: 100,
    quotaVisibility: 'usage-only',
    quotaNote: 'Provider does not expose upstream limits.',
    requests: 0,
    inputTokens: 0,
    outputTokens: 0,
    attributedCost: 0,
    attention: false,
    depleted: false,
  },
  {
    id: 'acc-cheaper',
    name: 'custom-openai-cheaper-i…',
    provider: 'custom-openai',
    authLabel: 'Dev · API key',
    initials: 'CU',
    status: 'paused',
    priority: 100,
    quotaVisibility: 'usage-only',
    quotaNote: 'Provider does not expose upstream limits.',
    requests: 172,
    inputTokens: 6_700_000,
    outputTokens: 300_000,
    attributedCost: 1.7,
    attention: false,
    depleted: false,
  },
  {
    id: 'acc-kenari',
    name: 'custom-openai-kenari',
    provider: 'custom-openai',
    authLabel: 'Dev · API key',
    initials: 'CU',
    status: 'paused',
    priority: 100,
    quotaVisibility: 'usage-only',
    quotaNote: 'Provider does not expose upstream limits.',
    requests: 160,
    inputTokens: 5_550_000,
    outputTokens: 250_000,
    attributedCost: 2.15,
    attention: false,
    depleted: false,
  },
  {
    id: 'acc-teamorou',
    name: 'custom-openai-teamorou…',
    provider: 'custom-openai',
    authLabel: 'Dev · API key',
    initials: 'CU',
    status: 'paused',
    priority: 100,
    quotaVisibility: 'usage-only',
    quotaNote: 'Provider does not expose upstream limits.',
    requests: 129,
    inputTokens: 4_700_000,
    outputTokens: 200_000,
    attributedCost: 1.12,
    attention: false,
    depleted: false,
  },
]

function simulateTraffic() {
  accounts = accounts.map((account) => {
    if (account.status !== 'active') {
      return account
    }

    const requests = Math.random() < 0.4 ? Math.round(Math.random() * 2) : 0
    const tokens = requests * Math.round(1_500 + Math.random() * 2_500)

    return {
      ...account,
      requests: account.requests + requests,
      inputTokens: account.inputTokens + Math.round(tokens * 0.9),
      outputTokens: account.outputTokens + (tokens - Math.round(tokens * 0.9)),
      attributedCost: Math.round((account.attributedCost + requests * 0.0035) * 10_000) / 10_000,
    }
  })
}

function buildSummary(range: QuotaRange): QuotaSummary {
  const share = RANGE_SHARE[range]
  const round = (value: number) => Math.round(value * 100) / 100

  const totals = accounts.reduce(
    (accumulator, account) => ({
      requests: accumulator.requests + account.requests,
      inputTokens: accumulator.inputTokens + account.inputTokens,
      outputTokens: accumulator.outputTokens + account.outputTokens,
      attributedCost: accumulator.attributedCost + account.attributedCost,
      paused: accumulator.paused + (account.status === 'paused' ? 1 : 0),
      attention: accumulator.attention + (account.attention ? 1 : 0),
      depleted: accumulator.depleted + (account.depleted ? 1 : 0),
      quotaCapable:
        accumulator.quotaCapable + (account.quotaVisibility === 'quota-capable' ? 1 : 0),
      usageOnly: accumulator.usageOnly + (account.quotaVisibility === 'usage-only' ? 1 : 0),
      notReported: accumulator.notReported + (account.quotaVisibility === 'not-reported' ? 1 : 0),
    }),
    {
      requests: 0,
      inputTokens: 0,
      outputTokens: 0,
      attributedCost: 0,
      paused: 0,
      attention: 0,
      depleted: 0,
      quotaCapable: 0,
      usageOnly: 0,
      notReported: 0,
    }
  )

  return {
    totalAccounts: accounts.length,
    activeAccounts: accounts.length - totals.paused,
    paused: totals.paused,
    attention: totals.attention,
    depleted: totals.depleted,
    requests: Math.round(totals.requests * share),
    inputTokens: Math.round(totals.inputTokens * share),
    outputTokens: Math.round(totals.outputTokens * share),
    attributedCost: round(totals.attributedCost * share),
    accountsReporting: accounts.filter((account) => account.quotaVisibility !== 'usage-only')
      .length,
    quotaCapable: totals.quotaCapable,
    usageOnly: totals.usageOnly,
    notReported: totals.notReported,
  }
}

function overview(range: QuotaRange = '30d'): Promise<AxiosItemResponse<QuotaOverview>> {
  simulateTraffic()

  const response = {
    data: {
      data: {
        summary: buildSummary(range),
        accounts: [...accounts],
      },
      metadata: {},
    },
  } as AxiosItemResponse<QuotaOverview>

  return Promise.resolve(response)
}

function toggleStatus(id: string): Promise<AxiosItemResponse<{ id: string }>> {
  accounts = accounts.map((account) =>
    account.id === id
      ? { ...account, status: account.status === 'active' ? 'paused' : 'active' }
      : account
  )

  const response = {
    data: { data: { id }, metadata: {} },
  } as AxiosItemResponse<{ id: string }>

  return Promise.resolve(response)
}

function remove(id: string): Promise<AxiosItemResponse<{ id: string }>> {
  accounts = accounts.filter((account) => account.id !== id)

  const response = {
    data: { data: { id }, metadata: {} },
  } as AxiosItemResponse<{ id: string }>

  return Promise.resolve(response)
}

export const quotaServices = {
  path,
  overview,
  toggleStatus,
  remove,
}
