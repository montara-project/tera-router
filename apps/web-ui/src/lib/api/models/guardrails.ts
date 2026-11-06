export type GuardrailsScope = 'global' | 'provider' | 'model' | 'chain' | 'key'

export type GuardrailsPiiConfig = {
  enabled: boolean
  entities: string[]
  masking_strategy: string
  min_confidence: number
  engine: string
  scan_output: boolean
}

export type GuardrailsInjectionConfig = {
  enabled: boolean
  severity: string
  action: string
}

export type GuardrailsTopicsConfig = {
  enabled: boolean
  mode: string
  topics: string[]
  action: string
  engine: string
}

export type GuardrailsToxicityConfig = {
  enabled: boolean
  categories: string[]
  threshold: number
  action: string
  engine: string
}

export type GuardrailsBiasConfig = {
  enabled: boolean
  categories: string[]
  threshold: number
  action: string
}

export type GuardrailsPolicyConfig = {
  pii: GuardrailsPiiConfig
  injection: GuardrailsInjectionConfig
  topics: GuardrailsTopicsConfig
  toxicity: GuardrailsToxicityConfig
  bias: GuardrailsBiasConfig
}

export type GuardrailPolicy = {
  id: string
  name: string
  enabled: boolean
  scope: GuardrailsScope
  /** provider/model/chain/key identifier this policy applies to; absent for global */
  target?: string
  protections: string[]
  /** per-detector configuration edited in the policy dialog; absent until first save */
  config?: GuardrailsPolicyConfig
}

/** What the gateway did with one screened request. */
export type GuardrailDecision = 'block' | 'redact' | 'mask' | 'hash' | 'warn' | 'log'

/** One decision the gateway recorded, as the audit tab lists it. */
export type GuardrailsDecisionEntry = {
  id: string
  /** "2006-01-02 15:04:05", UTC. */
  time: string
  actor: string
  decision: GuardrailDecision
  detectors: string[]
  /** PII entities the decision masked or blocked. */
  entities: string[]
  /** What each triggered detector matched. */
  reasons: string[]
  key_id: string
  overhead_ms: number
  key_name: string
  model: string
  chain: string
  request_id: string
}

export type GuardrailsOverview = {
  external_detectors: boolean
  policies: GuardrailPolicy[]
  decisions: GuardrailsDecisionEntry[]
}

/** One bucket of the actions series: a day, or an hour on short ranges. */
export type GuardrailSeriesPoint = {
  bucket: string
  blocked: number
  masked: number
  warned: number
  logged: number
}

/** One ranked row of a breakdown, split by decision kind. */
export type GuardrailBreakdownRow = {
  key: string
  label: string
  blocked: number
  masked: number
  warned: number
  logged: number
}

/** One ranked count with no decision split. */
export type GuardrailCountRow = {
  key: string
  count: number
}

/** Screen duration over the window's decisions, in milliseconds. */
export type GuardrailOverhead = {
  /** 0 until a decision records a duration. */
  samples: number
  p50: number
  p95: number
  avg: number
}

/** GET /v1/guardrails/metrics: the overview tab's whole payload. */
export type GuardrailMetrics = {
  range: string
  /** Series buckets are hours on the short ranges, days otherwise. */
  hourly: boolean
  /** Requests the gateway served plus the ones the guardrails blocked. */
  checked: number
  blocked: number
  masked: number
  warned: number
  logged: number
  overhead: GuardrailOverhead
  series: GuardrailSeriesPoint[]
  detectors: GuardrailBreakdownRow[]
  reasons: GuardrailCountRow[]
  keys: GuardrailBreakdownRow[]
  models: GuardrailBreakdownRow[]
  entities: GuardrailCountRow[]
}
