import { capitalizeFirstLetter } from '../string'

export const CHAIN_STRATEGY = {
  PRIORITY: 'priority',
  ROUND_ROBIN: 'round_robin',
  LATENCY: 'latency',
  COST: 'cost',
} as const

export const CHAIN_STRATEGY_OPTIONS = Object.entries(CHAIN_STRATEGY).map(([key, value]) => ({
  value,
  label: capitalizeFirstLetter(key),
}))

export type ChainStrategy = (typeof CHAIN_STRATEGY)[keyof typeof CHAIN_STRATEGY]
