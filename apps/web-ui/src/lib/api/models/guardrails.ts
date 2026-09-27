export type GuardrailsScope = 'global' | 'provider' | 'model' | 'chain' | 'key'

export type GuardrailsPiiConfig = {
  enabled: boolean
  entities: string[]
  maskingStrategy: string
  minConfidence: number
  engine: string
  scanOutput: boolean
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

export type GuardrailsAuditEntry = {
  id: string
  time: string
  actor: string
  action: string
  target: string
}

export type GuardrailsOverview = {
  externalDetectors: boolean
  policies: GuardrailPolicy[]
  audit: GuardrailsAuditEntry[]
}
