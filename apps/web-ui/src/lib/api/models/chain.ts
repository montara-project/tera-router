/** Matches the models.ChainStep json shape returned by the server. */
export type ChainStep = {
  id: string
  chain_id: string
  position: number
  provider: string
  model: string
  created_at: string
}

/** Matches the models.Chain json shape returned by the server. */
export type Chain = {
  id: string
  name: string
  strategy: string
  fallback_provider: string
  fallback_model: string
  context_window: number
  enabled: boolean
  steps: ChainStep[]
  created_at: string
  updated_at: string
}
