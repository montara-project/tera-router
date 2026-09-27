export type ApiKeyStatus = 'active' | 'disabled' | 'restricted'

/** Matches the keyView payload of GET /v1/keys. fullKey is only present on
 * the store response and the audit-logged reveal endpoint. */
export type ApiKey = {
  id: string
  name: string
  status: ApiKeyStatus
  keyPreview: string
  fullKey?: string
  planLabel: string
  planNote: string
  createdAt: string
  planId?: string
  lastUsedAt?: string | null
}
