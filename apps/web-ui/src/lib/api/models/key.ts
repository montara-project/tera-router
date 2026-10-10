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
}
