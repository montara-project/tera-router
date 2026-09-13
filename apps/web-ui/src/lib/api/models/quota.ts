export type QuotaAccountStatus = 'active' | 'paused'

export type QuotaVisibility = 'quota-capable' | 'usage-only' | 'not-reported'

export type QuotaRange = 'today' | '7d' | '30d'

export interface QuotaAccount {
  id: string
  name: string
  /** Provider name used by the provider filter */
  provider: string
  authLabel: string
  initials: string
  /** Renders the avatar with the provider brand color instead of the neutral one */
  brandAvatar?: boolean
  status: QuotaAccountStatus
  priority: number
  quotaVisibility: QuotaVisibility
  quotaNote: string
  requests: number
  inputTokens: number
  outputTokens: number
  attributedCost: number
  attention: boolean
  depleted: boolean
}

export interface QuotaSummary {
  totalAccounts: number
  activeAccounts: number
  paused: number
  attention: number
  depleted: number
  requests: number
  inputTokens: number
  outputTokens: number
  attributedCost: number
  accountsReporting: number
  quotaCapable: number
  usageOnly: number
  notReported: number
}

export interface QuotaOverview {
  summary: QuotaSummary
  accounts: QuotaAccount[]
}
