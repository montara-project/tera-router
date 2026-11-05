export type ApiKeyStatus = 'active' | 'disabled' | 'restricted'

/** Matches the keyView payload of GET /v1/keys. full_key is only present on
 * the store response and the audit-logged reveal endpoint. */
export type ApiKey = {
  id: string
  name: string
  status: ApiKeyStatus
  key_preview: string
  full_key?: string
  plan_label: string
  plan_note: string
  created_at: string
  plan_id?: string
  last_used_at?: string | null
  /** per-key narrowing of the plan allowlist; empty follows the plan */
  allowed_models: string[]
  /** skills injected into this key's requests, on top of the globally enabled ones */
  skill_ids: string[]
}

/** GET /v1/keys/:id — the list payload plus the fields only the detail page
 * renders. */
export type ApiKeyDetail = ApiKey & {
  scopes: string
  updated_at: string
  /** usage-portal link token; "" when the key has no portal link */
  portal_token?: string
}

/** GET /v1/keys/:id/usage — one key's traffic over the last `days` days. */
export type KeyUsage = {
  days: number
  /** client requests; fallback re-attempts count once */
  requests: number
  prompt_tokens: number
  completion_tokens: number
  cost_micros: number
}

/** GET /v1/keys/:id/guardrails — guardrail decisions on one key's traffic. */
export type KeyGuardrailStats = {
  days: number
  /** served plus blocked requests */
  requests: number
  blocked: number
  /** PII redacted, masked or hashed */
  masked: number
  warned: number
  /** log-only decisions */
  logged: number
}
