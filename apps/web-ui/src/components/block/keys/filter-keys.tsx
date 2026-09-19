import { Search } from 'lucide-react'

import type { Models } from '@/lib/api/models'

import SelectInput from '@/components/block/common/select-input'
import { Input, InputWrapper } from '@/components/ui/input'

export type KeysSortValue = 'newest' | 'oldest' | 'name'

export type KeysFilters = {
  search: string
  status: string
  sort: KeysSortValue
}

export const DEFAULT_KEYS_FILTERS: KeysFilters = {
  search: '',
  status: 'all',
  sort: 'newest',
}

const STATUS_OPTIONS = [
  { value: 'all', label: 'All status' },
  { value: 'active', label: 'Active' },
  { value: 'disabled', label: 'Disabled' },
  { value: 'restricted', label: 'Restricted' },
]

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'name', label: 'Name A–Z' },
]

interface FilterKeysProps {
  filters: KeysFilters
  onChange: (patch: Partial<KeysFilters>) => void
  count: number
}

export default function FilterKeys({ filters, onChange, count }: FilterKeysProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <InputWrapper variant="lg" className="w-full rounded-lg sm:w-72">
        <Search />
        <Input
          aria-label="Search keys"
          onChange={(event) => onChange({ search: event.target.value })}
          placeholder="Search keys..."
          value={filters.search}
        />
      </InputWrapper>

      <SelectInput
        className="w-36"
        defaultValue={filters.sort}
        onSelect={(value: string) => onChange({ sort: value as KeysSortValue })}
        options={SORT_OPTIONS}
        placeholder="Newest first"
      />
      <SelectInput
        className="w-32"
        defaultValue={filters.status}
        onSelect={(value: string) => onChange({ status: value })}
        options={STATUS_OPTIONS}
        placeholder="All status"
      />

      <span className="text-muted-foreground ml-auto text-xs whitespace-nowrap">
        {count} {count === 1 ? 'key' : 'keys'}
      </span>
    </div>
  )
}

export function applyKeysFilters(keys: Models.ApiKey[], filters: KeysFilters): Models.ApiKey[] {
  const query = filters.search.trim().toLowerCase()

  const filtered = keys.filter((key) => {
    if (filters.status !== 'all' && key.status !== filters.status) return false
    if (query && !key.name.toLowerCase().includes(query)) return false

    return true
  })

  const sorted = [...filtered]
  sorted.sort((left, right) => {
    switch (filters.sort) {
      case 'oldest':
        return left.createdAt.localeCompare(right.createdAt)
      case 'name':
        return left.name.localeCompare(right.name)
      case 'newest':
      default:
        return right.createdAt.localeCompare(left.createdAt)
    }
  })

  return sorted
}
