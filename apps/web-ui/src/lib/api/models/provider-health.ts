export type HealthStatus = 'healthy' | 'degraded' | 'down'

export type HealthWindow = '5m' | '15m' | '1h' | '6h' | '24h' | '7d'

export type HealthEntry = {
  id: string
  name: string
  status: HealthStatus
  requests: number
  fallbackRate: number
  finalFailures: number
  /** routing chains affected by this entry; null renders an em dash */
  affected: string | null
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
  avgP95Ms: number
  providers: HealthEntry[]
  models: HealthEntry[]
  chains: HealthEntry[]
  probes: ProbeEntry[]
}
