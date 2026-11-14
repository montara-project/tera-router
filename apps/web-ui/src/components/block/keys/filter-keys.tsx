import { IconSearch } from '@tabler/icons-react'

import type { Models } from '@/lib/api/models'

import { Input, InputWrapper } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export type KeysSortValue = 'newest' | 'oldest' | 'name'

export type KeysFilters = {
  search: string
  status: 'all' | Models.ApiKeyStatus
  sort: KeysSortValue
}

export const DEFAULT_KEYS_FILTERS: KeysFilters = {
  search: '',
  status: 'all',
  sort: 'newest',
}

export const SORT_OPTIONS: { value: KeysSortValue; label: string }[] = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'name', label: 'Name A–Z' },
]

const STATUS_CHIPS: { value: KeysFilters['status']; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'disabled', label: 'Disabled' },
  { value: 'restricted', label: 'Restricted' },
]

/** Keys per status across the whole list, counted by the server. */
export type KeyCounts = { all: number; active: number; disabled: number }

interface FilterKeysProps {
  counts: KeyCounts
  filters: KeysFilters
  onChange: (patch: Partial<KeysFilters>) => void
}

/** Search plus status chips with counts; Restricted shows only when a key has it. */
export default function FilterKeys({ counts, filters, onChange }: FilterKeysProps) {
  // The server reports no restricted keys yet, so that chip stays hidden.
  const count = (status: KeysFilters['status']) => (status === 'restricted' ? 0 : counts[status])

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5">
      <InputWrapper className="w-full sm:w-72">
        <IconSearch aria-hidden />
        <Input
          type="search"
          aria-label="Search name, key or plan"
          onChange={(event) => onChange({ search: event.target.value })}
          placeholder="Search name, key or plan"
          value={filters.search}
        />
      </InputWrapper>
      <div role="group" aria-label="Key status" className="flex flex-wrap gap-1.5">
        {STATUS_CHIPS.filter((c) => c.value !== 'restricted' || count('restricted') > 0).map(
          (chip) => {
            const active = filters.status === chip.value
            return (
              <button
                key={chip.value}
                type="button"
                aria-pressed={active}
                onClick={() => onChange({ status: chip.value })}
                className={cn(
                  'inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-[12.5px] font-medium',
                  active
                    ? 'border-primary/40 bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:text-foreground'
                )}
              >
                {chip.label}
                <span className="font-normal tabular-nums opacity-80">{count(chip.value)}</span>
              </button>
            )
          }
        )}
      </div>
    </div>
  )
}
