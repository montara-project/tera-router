/** One day of a key's traffic (UTC "YYYY-MM-DD"); quiet days are omitted. */
export type PortalDay = {
  day: string
  requests: number
  prompt_tokens: number
  completion_tokens: number
  cost_micros: number
}

export type PortalModel = {
  provider: string
  model: string
  requests: number
  prompt_tokens: number
  completion_tokens: number
  cost_micros: number
}

/** One attempt in the key's request log. */
export type PortalRequest = {
  created_at: string
  provider: string
  model: string
  prompt_tokens: number
  completion_tokens: number
  cost_micros: number
  latency_ms: number
  failed: boolean
  cache_hit: boolean
  prompt_reduced_bytes: number
  output_shaped: boolean
}

/** A plan or budget cap on the key; tokens or micro-USD. */
export type PortalLimit = {
  label: string
  kind: 'tokens' | 'spend'
  used: number
  limit: number
  resets_at: string
}

/** GET /v1/portal/:token — one key's usage, read with its portal link. */
export type PortalUsage = {
  key: { name: string; status: 'active' | 'disabled'; key_preview: string; plan_label: string }
  days: number
  summary: {
    requests: number
    prompt_tokens: number
    completion_tokens: number
    cost_micros: number
  }
  month: { requests: number; cost_micros: number }
  daily: PortalDay[]
  models: PortalModel[]
  recent: PortalRequest[]
  limits: PortalLimit[]
  /** effective allowlist; empty means every model */
  allowed_models: string[]
}
