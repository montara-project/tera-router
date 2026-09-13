import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'

import type { Models } from '@/lib/api/models'

import SelectInput from '@/components/block/common/select-input'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardHeading,
  CardTitle,
  CardToolbar,
} from '@/components/ui/card'
import { Input, InputWrapper } from '@/components/ui/input'

import QuotaAccountsTable from './quota-accounts-table'

interface AccountCapacityCardProps {
  accounts: Models.QuotaAccount[]
  loading?: boolean
  togglingId?: string | null
  onToggle: (account: Models.QuotaAccount) => void
  onDelete: (account: Models.QuotaAccount) => void
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

type SortValue = (typeof SORT_OPTIONS)[number]['value']

export default function AccountCapacityCard({
  accounts,
  loading = false,
  togglingId = null,
  onToggle,
  onDelete,
}: AccountCapacityCardProps) {
  const [search, setSearch] = useState('')
  const [provider, setProvider] = useState('all')
  const [status, setStatus] = useState('all')
  const [quotaState, setQuotaState] = useState('all')
  const [sort, setSort] = useState<SortValue>('attention')

  const providerOptions = useMemo(() => {
    const names = Array.from(new Set(accounts.map((account) => account.provider))).sort()

    return [
      { value: 'all', label: 'All providers' },
      ...names.map((name) => ({ value: name, label: name })),
    ]
  }, [accounts])

  const filteredAccounts = useMemo(() => {
    const query = search.trim().toLowerCase()

    const filtered = accounts.filter((account) => {
      if (provider !== 'all' && account.provider !== provider) return false
      if (status !== 'all' && account.status !== status) return false
      if (quotaState !== 'all' && account.quotaVisibility !== quotaState) return false
      if (query && !`${account.provider} ${account.name}`.toLowerCase().includes(query)) {
        return false
      }

      return true
    })

    const sorted = [...filtered]
    sorted.sort((left, right) => {
      switch (sort) {
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
  }, [accounts, provider, quotaState, search, sort, status])

  return (
    <Card>
      <CardHeader>
        <CardHeading>
          <CardTitle className="text-lg">Account capacity</CardTitle>
          <CardDescription className="text-sm">
            Upstream limits are shown only when the provider reports them; every account still shows
            local period usage.
          </CardDescription>
        </CardHeading>
        <CardToolbar>
          <span className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            Auto refresh · 5s
          </span>
        </CardToolbar>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <InputWrapper className="w-full sm:w-72">
            <Search />
            <Input
              aria-label="Search provider or account"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search provider or account..."
              value={search}
            />
          </InputWrapper>

          <SelectInput
            className="w-40"
            defaultValue="all"
            onSelect={setProvider}
            options={providerOptions}
            placeholder="All providers"
          />
          <SelectInput
            className="w-36"
            defaultValue="all"
            onSelect={setStatus}
            options={STATUS_OPTIONS}
            placeholder="All statuses"
          />
          <SelectInput
            className="w-40"
            defaultValue="all"
            onSelect={setQuotaState}
            options={QUOTA_STATE_OPTIONS}
            placeholder="All quota states"
          />
          <SelectInput
            className="w-36"
            defaultValue="attention"
            onSelect={(value) => setSort(value as SortValue)}
            options={SORT_OPTIONS}
            placeholder="Attention first"
          />

          <span className="text-muted-foreground ml-auto text-xs whitespace-nowrap">
            {filteredAccounts.length} accounts
          </span>
        </div>

        <QuotaAccountsTable
          accounts={filteredAccounts}
          loading={loading}
          onDelete={onDelete}
          onToggle={onToggle}
          togglingId={togglingId}
        />
      </CardContent>
    </Card>
  )
}
