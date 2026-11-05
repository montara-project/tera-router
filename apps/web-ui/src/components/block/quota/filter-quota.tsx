import { IconAdjustmentsHorizontal, IconSearch } from '@tabler/icons-react'
import { useMemo } from 'react'

import type { Models } from '@/lib/api/models'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button className="ml-auto" size="sm" variant="outline">
            <IconAdjustmentsHorizontal aria-hidden />
            Filters
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Sort by</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            onValueChange={(value) => onChange({ sort: value as QuotaSortValue })}
            value={filters.sort}
          >
            {SORT_OPTIONS.map((option) => (
              <DropdownMenuRadioItem key={option.value} value={option.value}>
                {option.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Quota state</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            onValueChange={(value) => onChange({ quotaState: value })}
            value={filters.quotaState}
          >
            {QUOTA_STATE_OPTIONS.map((option) => (
              <DropdownMenuRadioItem key={option.value} value={option.value}>
                {option.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Provider</DropdownMenuLabel>
          <div className="max-h-44 overflow-y-auto overscroll-contain">
            {providerOptions.map((option) => (
              <DropdownMenuCheckboxItem
                key={option.value}
                checked={filters.provider === option.value}
                onCheckedChange={() =>
                  onChange({ provider: filters.provider === option.value ? 'all' : option.value })
                }
                onSelect={(event) => event.preventDefault()}
              >
                {option.label}
              </DropdownMenuCheckboxItem>
            ))}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
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
