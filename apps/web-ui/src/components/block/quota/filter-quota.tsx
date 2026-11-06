import { IconAdjustmentsHorizontal, IconSearch } from '@tabler/icons-react'
import { useId, useMemo, useState } from 'react'

import type { Models } from '@/lib/api/models'

import SelectInput from '@/components/block/common/select-input'
import { Button } from '@/components/ui/button'
import { Input, InputWrapper } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export type QuotaSortValue = 'attention' | 'name' | 'requests' | 'cost'

export type QuotaFilters = {
  search: string
  provider: string
  status: 'all' | 'active' | 'paused' | 'attention'
  quotaState: string
  sort: QuotaSortValue
}

export const DEFAULT_QUOTA_FILTERS: QuotaFilters = {
  search: '',
  provider: 'all',
  status: 'all',
  quotaState: 'all',
  sort: 'attention',
}

/** Quick status chips above the table (All / Active / Paused / Needs attention). */
export const QUOTA_STATUS_CHIPS: { value: QuotaFilters['status']; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'attention', label: 'Needs attention' },
]

const QUOTA_STATE_OPTIONS = [
  { value: 'all', label: 'All quota states' },
  { value: 'quota-capable', label: 'Quota capable' },
  { value: 'usage-only', label: 'Usage only' },
  { value: 'not-reported', label: 'Not reported' },
]

const SORT_OPTIONS: { value: QuotaSortValue; label: string }[] = [
  { value: 'attention', label: 'Attention first' },
  { value: 'name', label: 'Name A–Z' },
  { value: 'requests', label: 'Most requests' },
  { value: 'cost', label: 'Highest cost' },
]

interface FilterQuotaProps {
  filters: QuotaFilters
  onChange: (patch: Partial<QuotaFilters>) => void
  /** Full (unfiltered) account list, for the chip counts and provider list. */
  accounts: Models.QuotaAccount[]
}

export default function FilterQuota({ filters, onChange, accounts }: FilterQuotaProps) {
  const panelId = useId()
  // Open while a provider, quota or sort choice differs from the default, so
  // an active filter is never hidden behind the toggle.
  const [open, setOpen] = useState(
    filters.provider !== 'all' || filters.quotaState !== 'all' || filters.sort !== 'attention'
  )
  const chipCounts = useMemo(() => {
    const counts = { all: accounts.length, active: 0, paused: 0, attention: 0 }
    for (const account of accounts) {
      if (account.status === 'active') counts.active += 1
      else counts.paused += 1
      if (account.attention) counts.attention += 1
    }
    return counts
  }, [accounts])

  const providerOptions = useMemo(() => {
    const names = Array.from(new Set(accounts.map((account) => account.provider))).sort()
    return names.map((name) => ({ value: name, label: name }))
  }, [accounts])

  return (
    <div className="flex w-full flex-col gap-2">
      {/* Toolbar row on its own, so opening the filter row below never moves
          the Filters button. */}
      <div className="flex flex-wrap items-center gap-2">
        <InputWrapper variant="md" className="w-full rounded-md sm:w-60">
          <IconSearch className="size-3.5" />
          <Input
            aria-label="Search provider or account"
            onChange={(event) => onChange({ search: event.target.value })}
            placeholder="Search accounts"
            value={filters.search}
          />
        </InputWrapper>

        <div className="flex flex-wrap items-center gap-1">
          {QUOTA_STATUS_CHIPS.map((chip) => {
            const active = filters.status === chip.value

            return (
              <button
                key={chip.value}
                type="button"
                aria-pressed={active}
                onClick={() => onChange({ status: chip.value })}
                className={cn(
                  'inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors',
                  active
                    ? 'border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400'
                    : 'border-border text-muted-foreground hover:text-foreground'
                )}
              >
                {chip.label}
                <span className={cn('tabular-nums', !active && 'opacity-70')}>
                  {chipCounts[chip.value]}
                </span>
              </button>
            )
          })}
        </div>

        <Button
          className="ml-auto aria-expanded:bg-accent"
          size="sm"
          variant="outline"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((v) => !v)}
        >
          <IconAdjustmentsHorizontal aria-hidden />
          Filters
        </Button>
      </div>

      {open && (
        <div id={panelId} className="grid w-full gap-x-3 gap-y-2 sm:grid-cols-3">
          <FilterField id={`${panelId}-provider`} label="Provider">
            <SelectInput
              id={`${panelId}-provider`}
              value={filters.provider}
              onSelect={(provider) => onChange({ provider })}
              className="w-full"
              options={[{ value: 'all', label: 'All providers' }, ...providerOptions]}
            />
          </FilterField>
          <FilterField id={`${panelId}-quota`} label="Quota">
            <SelectInput
              id={`${panelId}-quota`}
              value={filters.quotaState}
              onSelect={(quotaState) => onChange({ quotaState })}
              className="w-full"
              options={QUOTA_STATE_OPTIONS}
            />
          </FilterField>
          <FilterField id={`${panelId}-sort`} label="Sort">
            <SelectInput
              id={`${panelId}-sort`}
              value={filters.sort}
              onSelect={(sort) => onChange({ sort: sort as QuotaSortValue })}
              className="w-full"
              options={SORT_OPTIONS}
            />
          </FilterField>
        </div>
      )}
    </div>
  )
}

function FilterField({
  id,
  label,
  children,
}: {
  id: string
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <label htmlFor={id} className="shrink-0 text-xs text-muted-foreground">
        {label}
      </label>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

export function applyQuotaFilters(
  accounts: Models.QuotaAccount[],
  filters: QuotaFilters
): Models.QuotaAccount[] {
  const query = filters.search.trim().toLowerCase()

  const filtered = accounts.filter((account) => {
    if (filters.provider !== 'all' && account.provider !== filters.provider) return false
    if (filters.status !== 'all') {
      if (filters.status === 'attention' ? !account.attention : account.status !== filters.status) {
        return false
      }
    }
    if (filters.quotaState !== 'all' && account.quota_visibility !== filters.quotaState) {
      return false
    }
    if (query && !`${account.provider} ${account.name}`.toLowerCase().includes(query)) {
      return false
    }

    return true
  })

  const sorted = [...filtered]
  sorted.sort((left, right) => {
    switch (filters.sort) {
      case 'name':
        return left.name.localeCompare(right.name)
      case 'requests':
        return right.requests - left.requests
      case 'cost':
        return right.attributed_cost - left.attributed_cost
      case 'attention':
      default: {
        // Stable sort: flagged accounts first, otherwise keep the original order
        return (right.attention ? 1 : 0) - (left.attention ? 1 : 0)
      }
    }
  })

  return sorted
}
