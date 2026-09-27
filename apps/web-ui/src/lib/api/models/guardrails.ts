export type GuardrailsScope = 'global' | 'provider' | 'model' | 'chain' | 'key'

export type GuardrailPolicy = {
  id: string
  name: string
  enabled: boolean
  scope: GuardrailsScope
  /** provider/model/chain/key identifier this policy applies to; absent for global */
  target?: string
  protections: string[]
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
