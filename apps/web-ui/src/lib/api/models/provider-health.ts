export type HealthStatus = 'healthy' | 'degraded' | 'down'

export type HealthWindow = '5m' | '15m' | '1h' | '6h' | '24h' | '7d' | '30d' | '90d'

export type HealthEntry = {
  id: string
  name: string
  status: HealthStatus
  requests: number
  fallbackRate: number
  /** failed attempts another target recovered */
  fallbacks: number
  finalFailures: number
  /** most frequent failure kind (auth, rate_limit, …); empty when nothing failed */
  mainIssue: string
  /** chains only: the provider/model whose attempts failed most */
  mostAffected?: string
  /** routing chains affected by this entry; null renders an em dash */
  affected: string | null
  /** successful attempts over all attempts, percent */
  successRate: number
  p95Ms: number
  /** the window split into 24 equal slices, oldest first */
  buckets: { requests: number; failed: number }[]
  /** chains only: successful attempts per model, busiest first */
  served?: { model: string; requests: number }[]
}

export type ProbeEntry = {
  id: string
  name: string
  target: string
  status: 'pass' | 'fail'
  latencyMs: number
  lastRun: string
}

export type ProviderHealthOverview = {
  fallbacks: number
  /** client requests in the window (attempts of one request count once) */
  requests: number
  avgP95Ms: number
  providers: HealthEntry[]
  models: HealthEntry[]
  chains: HealthEntry[]
  probes: ProbeEntry[]
}
