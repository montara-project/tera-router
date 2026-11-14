import { IconSearch } from '@tabler/icons-react'

import type { Models } from '@/lib/api/models'

import SelectInput from '@/components/block/common/select-input'
import { Input, InputWrapper } from '@/components/ui/input'
import { CHAIN_STRATEGY_OPTIONS } from '@/lib/constants/chain'

/** Health filter values: the server's statuses plus chains it has no entry for. */
export type ChainHealthFilter = 'all' | Models.HealthStatus | 'unknown'

export type ChainFilters = {
  search: string
  strategy: string
  health: ChainHealthFilter
}

export const DEFAULT_CHAIN_FILTERS: ChainFilters = { search: '', strategy: 'all', health: 'all' }

/** Chain row; the list attaches the 24h health entry when the chain has one. */
export type ChainRow = Models.Chain

/** Chains per strategy and per health status across the whole list, counted
 * by the server: the figures in the filter labels. */
export type ChainCounts = {
  all: number
  strategy: Record<string, number>
  health: Record<string, number>
}

const HEALTH_OPTIONS: { value: Exclude<ChainHealthFilter, 'all'>; label: string }[] = [
  { value: 'healthy', label: 'Healthy' },
  { value: 'degraded', label: 'Degraded' },
  { value: 'down', label: 'Unhealthy' },
  { value: 'unknown', label: 'Unknown' },
]

interface FilterChainProps {
  counts: ChainCounts
  filters: ChainFilters
  onChange: (patch: Partial<ChainFilters>) => void
}

/** Panel toolbar of the chains table; option labels carry their match count. */
export default function FilterChain({ counts, filters, onChange }: FilterChainProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <InputWrapper className="w-full sm:w-64">
        <IconSearch aria-hidden />
        <Input
          type="search"
          aria-label="Search chains or models"
          value={filters.search}
          onChange={(event) => onChange({ search: event.target.value })}
          placeholder="Search"
        />
      </InputWrapper>

      <SelectInput
        aria-label="Strategy"
        value={filters.strategy}
        onSelect={(strategy) => onChange({ strategy })}
        className="w-full sm:w-44"
        options={[
          { value: 'all', label: `All strategies (${counts.all})` },
          ...CHAIN_STRATEGY_OPTIONS.map((o) => ({
            value: o.value as string,
            label: `${o.label} (${counts.strategy[o.value] ?? 0})`,
          })),
        ]}
      />

      <SelectInput
        aria-label="Health in the last 24 hours"
        value={filters.health}
        onSelect={(health) => onChange({ health: health as ChainHealthFilter })}
        className="w-full sm:w-40"
        options={[
          { value: 'all', label: 'Any health' },
          ...HEALTH_OPTIONS.map((o) => ({
            value: o.value as string,
            label: `${o.label} (${counts.health[o.value] ?? 0})`,
          })),
        ]}
      />
    </div>
  )
}
