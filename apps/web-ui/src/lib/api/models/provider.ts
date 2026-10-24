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
  /** At least one account can serve traffic (enabled, no re-auth pending). */
  usable?: boolean
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

/** How a provider spreads requests over its accounts. */
export const ACCOUNT_STRATEGIES = [
  'default',
  'fill-first',
  'round-robin',
  'smart-round-robin',
] as const
export type AccountStrategy = (typeof ACCOUNT_STRATEGIES)[number]

/** GET/PUT /v1/providers/:id/routing. */
export type ProviderRouting = {
  strategy: AccountStrategy
  /** requests (smart: new sessions) per account before the next takes over */
  sticky_limit: number
  /** smart round robin: how long a conversation stays on its account */
  affinity_hours: number
}
