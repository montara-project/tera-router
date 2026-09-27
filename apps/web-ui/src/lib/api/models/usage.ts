export type UsageRange = 'today' | '24h' | '7d' | '30d'

export type UsageSummary = {
  requests: number
  prompt_tokens: number
  completion_tokens: number
  cost_micros: number
  avg_latency_ms: number
}

export type UsageByModel = {
  provider: string
  model: string
  requests: number
  prompt_tokens: number
  completion_tokens: number
  cost_micros: number
  avg_latency_ms: number
}

export type UsageDaily = {
  day: string
  requests: number
  cost_micros: number
  tokens: number
}
