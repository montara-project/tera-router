export type QuotaAccountStatus = 'active' | 'paused'

export type QuotaVisibility = 'quota-capable' | 'usage-only' | 'not-reported'

export type QuotaRange = 'today' | '7d' | '30d'

export interface QuotaAccount {
  id: string
  name: string
  /** Provider name used by the provider filter */
  provider: string
  auth_label: string
  initials: string
  /** Renders the avatar with the provider brand color instead of the neutral one */
  brand_avatar?: boolean
  status: QuotaAccountStatus
  priority: number
  quota_visibility: QuotaVisibility
  quota_note: string
  requests: number
  input_tokens: number
  output_tokens: number
  attributed_cost: number
  attention: boolean
  depleted: boolean
}

export interface QuotaSummary {
  total_accounts: number
  active_accounts: number
  paused: number
  attention: number
  depleted: number
  requests: number
  input_tokens: number
  output_tokens: number
  attributed_cost: number
  accounts_reporting: number
  quota_capable: number
  usage_only: number
  not_reported: number
}

export interface QuotaOverview {
  summary: QuotaSummary
  accounts: QuotaAccount[]
}
