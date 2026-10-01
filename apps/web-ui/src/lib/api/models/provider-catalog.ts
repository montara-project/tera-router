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
  /** how many models got a pricing override imported during this sync */
  priced?: number
  /** filtered total across pages (pagination) */
  total?: number
  /** active models over the whole catalog */
  enabled?: number
  /** models in the whole catalog */
  count?: number
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

/** One turn of a model test conversation. */
export type ModelTestMessage = {
  role: 'user' | 'assistant'
  content: string
}

/** Matches the POST .../models/test payload data. */
export type ModelTestResult = {
  ok: boolean
  status: number
  latency_ms: number
  model: string
  content: string
  detail: string
  input_tokens: number
  output_tokens: number
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
