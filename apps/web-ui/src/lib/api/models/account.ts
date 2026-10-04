export type AccountAuthKind = 'api_key' | 'oauth' | 'none'

export type AccountStatus = 'active' | 'paused'

/** Matches the accountView payload of GET /v1/accounts. */
export type Account = {
  id: string
  provider: string
  label: string
  auth_kind: AccountAuthKind
  key_fingerprint: string
  token_expires_at: string | null
  metadata: Record<string, unknown>
  priority: number
  status: AccountStatus
  disabled: boolean
  proxy_pool_id: string | null
  needs_reconnect: boolean
  created_at: string
  updated_at: string
}

export type TestResult = {
  ok: boolean
  status: number
  latency_ms: number
  detail: string
}

/** One subscription rate-limit window reported upstream: `five_hour` is the
 * rolling session, `seven_day*` the weekly allowances. */
export type QuotaWindow = {
  key: string
  /** percent of the window's allowance already used (0–100) */
  utilization: number
  resets_at: string | null
}

/** Matches GET /v1/accounts/:id/quota. */
export type AccountQuota = {
  account_id: string
  quota_visibility: 'upstream' | 'usage-only'
  quota_note: string
  windows: QuotaWindow[]
  fetched_at?: string
}
