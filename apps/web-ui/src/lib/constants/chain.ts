import {
  IconArrowsShuffle,
  IconBolt,
  IconCoin,
  IconListNumbers,
  type IconProps,
} from '@tabler/icons-react'

export const CHAIN_STRATEGY = {
  PRIORITY: 'priority',
  ROUND_ROBIN: 'round_robin',
  LATENCY: 'latency',
  COST: 'cost',
} as const

export type ChainStrategy = (typeof CHAIN_STRATEGY)[keyof typeof CHAIN_STRATEGY]

type StrategyMeta = {
  value: ChainStrategy
  label: string
  icon: React.ComponentType<IconProps>
  /** what the gateway does with the chain's steps */
  description: string
}

// The gateway rotates round_robin chains and walks every other strategy in
// step order, so latency and cost say so instead of promising a sort.
export const CHAIN_STRATEGY_OPTIONS: StrategyMeta[] = [
  {
    value: 'priority',
    label: 'Priority',
    icon: IconListNumbers,
    description: 'Tries models in the order listed.',
  },
  {
    value: 'round_robin',
    label: 'Round robin',
    icon: IconArrowsShuffle,
    description: 'Starts each request at the next model, then falls back in order.',
  },
  {
    value: 'latency',
    label: 'Latency',
    icon: IconBolt,
    description: 'Saved as latency. Routing does not sort by latency yet, so models run in order.',
  },
  {
    value: 'cost',
    label: 'Cost',
    icon: IconCoin,
    description: 'Saved as cost. Routing does not sort by cost yet, so models run in order.',
  },
]

/** Display label for a stored strategy, including older spellings. */
export function chainStrategyLabel(strategy: string) {
  const normalized = strategy.replace('-', '_')
  return (
    CHAIN_STRATEGY_OPTIONS.find((o) => o.value === normalized)?.label ??
    (strategy ? strategy.charAt(0).toUpperCase() + strategy.slice(1) : 'Priority')
  )
}
