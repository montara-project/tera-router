/** Matches the models.CustomProvider json shape. */
export type CustomProvider = {
  id: string
  name: string
  slug: string
  base_url: string
  api_kind: string
  pricing: string
  metadata: string
  enabled: boolean
  priority: number
  created_at: string
  updated_at: string
}

/** Per-model catalog state: active models are routable and advertised. */
export type ProviderModelState = 'active' | 'disabled'

/** One stored catalog entry: an upstream model id and its operator-set state. */
export type ProviderModel = {
  id: string
  state: ProviderModelState
}

/** Matches the GET /v1/custom-providers/:id/models payload. */
export type UpstreamModels = {
  models: ProviderModel[]
  fetched_at?: string | null
}

/** One ordered candidate within a model alias pool. */
export type AliasTarget = {
  id: string
  alias_id: string
  position: number
  provider: string
  model: string
  active: boolean
}

/** Matches the models.ModelAlias json shape. */
export type ModelAlias = {
  id: string
  name: string
  context_window: number
  active: boolean
  targets: AliasTarget[]
  created_at: string
  updated_at: string
}
