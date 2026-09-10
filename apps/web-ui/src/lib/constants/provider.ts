import { capitalizeFirstLetter } from '../string'

export const PROVIDER_HEALTH = {
  HEALTHY: 'healthy',
  DEGRADED: 'degraded',
  UNHEALTHY: 'unhealthy',
  UNKNOWN: 'unknown',
} as const

export const PROVIDER_HEALTH_OPTIONS = Object.entries(PROVIDER_HEALTH).map(([key, value]) => ({
  value,
  label: capitalizeFirstLetter(key),
}))

export type ProviderHealth = (typeof PROVIDER_HEALTH)[keyof typeof PROVIDER_HEALTH]
