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

export type AccountPayload = {
  provider: string
  label?: string
  auth_kind: AccountAuthKind
  api_key?: string
  token?: string
  refresh?: string
  metadata?: Record<string, unknown>
  priority?: number
  proxy_pool_id?: string
  disabled?: boolean
}

export type TestResult = {
  ok: boolean
  status: number
  latency_ms: number
  detail: string
}
