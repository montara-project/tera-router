export type ProviderCapability =
  | 'chat'
  | 'embeddings'
  | 'image'
  | 'stt'
  | 'tts'
  | 'search'
  | 'fetch'

export type Provider = {
  id: string
  name: string
  slug: string
  connected: boolean
  /** false renders the "unofficial" badge */
  official?: boolean
  /** upstream wire format: openai, anthropic, openai_responses */
  api_kind?: string
  accounts?: number
  capabilities: ProviderCapability[]
}

export type ProvidersOverview = {
  connected: Provider[]
  available: Provider[]
}
