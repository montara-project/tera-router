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
  /** Sizes of the two lists before any filter. */
  connected_count: number
  available_count: number
  /** Connected providers that match the filters, before paging. */
  connected_total: number
  /** Connected custom providers with no account left. */
  empty_count: number
}

/** Query of GET /v1/providers. The server filters both lists and, with a
 * limit, pages the connected one. */
export type ProvidersOverviewDto = {
  /** Matches the provider name or slug. */
  search?: string
  capability?: ProviderCapability
  /** Keeps the connected custom providers with no account. */
  empty?: boolean
  offset?: number
  limit?: number
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
