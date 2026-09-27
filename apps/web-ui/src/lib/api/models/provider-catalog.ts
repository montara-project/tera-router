/** Matches the models.CustomProvider json shape. */
export type CustomProvider = {
  id: string
  name: string
  slug: string
  base_url: string
  api_kind: string
  enabled: boolean
  priority: number
  created_at: string
  updated_at: string
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
