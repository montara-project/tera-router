export type ApiKeyStatus = 'active' | 'disabled' | 'restricted'

export type ApiKey = {
  id: string
  name: string
  status: ApiKeyStatus
  keyPreview: string
  fullKey: string
  planLabel: string
  planNote: string
  createdAt: string
}
