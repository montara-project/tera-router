import { Search } from 'lucide-react'

import type { Models } from '@/lib/api/models'

import SelectInput from '@/components/block/common/select-input'
import { Input, InputWrapper } from '@/components/ui/input'

export type QuotaSortValue = 'attention' | 'name' | 'requests' | 'cost'

export type QuotaFilters = {
  search: string
  provider: string
  status: string
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

const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
]

const QUOTA_STATE_OPTIONS = [
  { value: 'all', label: 'All quota states' },
  { value: 'quota-capable', label: 'Quota capable' },
  { value: 'usage-only', label: 'Usage only' },
  { value: 'not-reported', label: 'Not reported' },
]

const SORT_OPTIONS = [
  { value: 'attention', label: 'Attention first' },
  { value: 'name', label: 'Name A–Z' },
  { value: 'requests', label: 'Most requests' },
  { value: 'cost', label: 'Highest cost' },
]

interface FilterQuotaProps {
  filters: QuotaFilters
  onChange: (patch: Partial<QuotaFilters>) => void
  providerOptions: { value: string; label: string }[]
  count: number
}

export default function FilterQuota({
  filters,
  onChange,
  providerOptions,
  count,
}: FilterQuotaProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <InputWrapper variant="lg" className="w-full rounded-lg sm:w-72">
        <Search />
        <Input
          aria-label="Search provider or account"
          onChange={(event) => onChange({ search: event.target.value })}
          placeholder="Search provider or account..."
          value={filters.search}
        />
      </InputWrapper>

      <SelectInput
        className="w-40"
        defaultValue={filters.provider}
        onSelect={(value: string) => onChange({ provider: value })}
        options={providerOptions}
        placeholder="All providers"
      />
      <SelectInput
        className="w-36"
        defaultValue={filters.status}
        onSelect={(value: string) => onChange({ status: value })}
        options={STATUS_OPTIONS}
        placeholder="All statuses"
      />
      <SelectInput
        className="w-40"
        defaultValue={filters.quotaState}
        onSelect={(value: string) => onChange({ quotaState: value })}
        options={QUOTA_STATE_OPTIONS}
        placeholder="All quota states"
      />
      <SelectInput
        className="w-36"
        defaultValue={filters.sort}
        onSelect={(value: string) => onChange({ sort: value as QuotaSortValue })}
        options={SORT_OPTIONS}
        placeholder="Attention first"
      />

      <span className="text-muted-foreground ml-auto text-xs whitespace-nowrap">
        {count} accounts
      </span>
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
    if (filters.status !== 'all' && account.status !== filters.status) return false
    if (filters.quotaState !== 'all' && account.quotaVisibility !== filters.quotaState) return false
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
        return right.attributedCost - left.attributedCost
      case 'attention':
      default: {
        // Stable sort: flagged accounts first, otherwise keep the original order
        return (right.attention ? 1 : 0) - (left.attention ? 1 : 0)
      }
    }
  })

  return sorted
}
