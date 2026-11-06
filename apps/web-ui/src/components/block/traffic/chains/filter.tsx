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

/** Chain row with its 24h health entry, when the server reported one. */
export type ChainRow = Models.Chain & { health?: Models.HealthEntry }

const HEALTH_OPTIONS: { value: Exclude<ChainHealthFilter, 'all'>; label: string }[] = [
  { value: 'healthy', label: 'Healthy' },
  { value: 'degraded', label: 'Degraded' },
  { value: 'down', label: 'Unhealthy' },
  { value: 'unknown', label: 'Unknown' },
]

const healthOf = (row: ChainRow): Exclude<ChainHealthFilter, 'all'> =>
  row.health?.status ?? 'unknown'

/** Rows matching every filter. Search covers chain names and step models. */
export function filterChains(rows: ChainRow[], filters: ChainFilters) {
  const q = filters.search.trim().toLowerCase()
  return rows.filter((row) => {
    if (filters.strategy !== 'all' && row.strategy !== filters.strategy) return false
    if (filters.health !== 'all' && healthOf(row) !== filters.health) return false
    if (!q) return true
    return [row.name, row.fallback_model, ...row.steps.map((s) => `${s.provider}/${s.model}`)]
      .join(' ')
      .toLowerCase()
      .includes(q)
  })
}

interface FilterChainProps {
  rows: ChainRow[]
  filters: ChainFilters
  onChange: (patch: Partial<ChainFilters>) => void
}

/** Panel toolbar of the chains table; option labels carry their match count. */
export default function FilterChain({ rows, filters, onChange }: FilterChainProps) {
  const count = (match: (row: ChainRow) => boolean) => rows.filter(match).length

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
          { value: 'all', label: `All strategies (${rows.length})` },
          ...CHAIN_STRATEGY_OPTIONS.map((o) => ({
            value: o.value as string,
            label: `${o.label} (${count((row) => row.strategy === o.value)})`,
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
            label: `${o.label} (${count((row) => healthOf(row) === o.value)})`,
          })),
        ]}
      />
    </div>
  )
}
