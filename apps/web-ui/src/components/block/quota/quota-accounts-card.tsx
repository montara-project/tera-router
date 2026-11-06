import type { ColumnDef } from '@tanstack/react-table'

import { IconEyeOff, IconGauge, IconPower, IconUsers } from '@tabler/icons-react'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'

import type { Models } from '@/lib/api/models'

import EmptyState from '@/components/block/common/empty-state'
import ReactTable, { features } from '@/components/block/common/react-table'
import RowColumnAction from '@/components/block/common/row-column-action'
import SectionCardPanel from '@/components/block/common/section-card-panel'
import SimpleAlertDialog from '@/components/block/common/simple-alert-dialog'
import { getProviderBrand, ProviderAvatar } from '@/components/block/providers/provider-avatar'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { toastAxiosError } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'
import { formatUsd } from '@/lib/currency'
import { formatCompact, formatCount } from '@/lib/format'
import { cn } from '@/lib/utils'

import FilterQuota, { type QuotaFilters } from './filter-quota'

const VISIBILITY_DOTS: Record<Models.QuotaAccount['quota_visibility'], string> = {
  'quota-capable': 'bg-emerald-500',
  'usage-only': 'bg-zinc-500',
  'not-reported': 'bg-amber-500',
}

const VISIBILITY_LABELS: Record<Models.QuotaAccount['quota_visibility'], string> = {
  'quota-capable': 'Quota capable',
  'usage-only': 'Usage only',
  'not-reported': 'Not reported',
}

/** The pager never offers fewer than 10 rows. */
const PAGE_SIZES = [10, 25, 50, 100]

const BADGE_ACTIVE =
  'flex h-5 w-fit items-center rounded-sm border border-emerald-500/20 bg-emerald-500/10 px-1.5 text-[11.5px] font-medium text-emerald-600 dark:text-emerald-400'
const BADGE_PAUSED =
  'flex h-5 w-fit items-center rounded-sm border border-border bg-muted/40 px-1.5 text-[11.5px] font-medium text-muted-foreground'

/** Brand logo when the provider has one, otherwise the account's initials. */
function AccountAvatar({ account }: { account: Models.QuotaAccount }) {
  if (getProviderBrand(account.provider).icon) {
    return <ProviderAvatar slug={account.provider} size="sm" className="size-6 rounded-sm" />
  }
  return (
    <span className="flex size-6 shrink-0 items-center justify-center rounded-sm border border-border bg-muted font-mono text-[10px] font-medium text-muted-foreground">
      {account.initials}
    </span>
  )
}

interface QuotaAccountsCardProps {
  /** Full unfiltered list, for the header count, chips and provider list. */
  accounts: Models.QuotaAccount[]
  /** Filtered rows for the current page. */
  paged: Models.QuotaAccount[]
  /** Filtered row count. */
  total: number
  loading: boolean
  pageIndex: number
  pageSize: number
  filters: QuotaFilters
  onChange: (patch: Partial<QuotaFilters>) => void
}

/** Accounts panel: filter row, bulk actions and the quota table. */
export default function QuotaAccountsCard({
  accounts,
  paged,
  total,
  loading,
  pageIndex,
  pageSize,
  filters,
  onChange,
}: QuotaAccountsCardProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const toggleMutation = useMutation(queries.quota.toggleStatus())

  const visibleIds = paged.map((row) => row.id)
  const selectedVisible = visibleIds.filter((id) => selected.has(id))
  const allVisibleSelected = visibleIds.length > 0 && selectedVisible.length === visibleIds.length

  const toggleVisible = () =>
    setSelected((previous) => {
      const next = new Set(previous)
      for (const id of visibleIds) {
        if (allVisibleSelected) next.delete(id)
        else next.add(id)
      }
      return next
    })

  const toggleOne = (id: string) =>
    setSelected((previous) => {
      const next = new Set(previous)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const bulkToggle = async (pause: boolean) => {
    // The endpoint flips state, so only touch accounts not already there.
    const ids = accounts
      .filter((a) => selected.has(a.id) && (a.status === 'active') === pause)
      .map((a) => a.id)
    try {
      for (const id of ids) await toggleMutation.mutateAsync(id)
      toast.success(`Account${ids.length === 1 ? '' : 's'} ${pause ? 'paused' : 'activated'}`)
      setSelected(new Set())
    } catch (error) {
      toastAxiosError(error)
    }
  }

  const columns: ColumnDef<typeof features, Models.QuotaAccount, unknown>[] = [
    {
      id: 'select',
      header: () => (
        <Checkbox
          aria-label="Select all rows"
          checked={allVisibleSelected ? true : selectedVisible.length > 0 ? 'indeterminate' : false}
          onCheckedChange={toggleVisible}
        />
      ),
      meta: { headerClassName: 'w-10' },
      cell: ({ row }) => (
        <Checkbox
          aria-label={`Select ${row.original.name}`}
          checked={selected.has(row.original.id)}
          onCheckedChange={() => toggleOne(row.original.id)}
        />
      ),
    },
    {
      id: 'account',
      header: 'Account',
      meta: { headerClassName: 'w-[31%]', cellClassName: 'max-w-0' },
      cell: ({ row }) => {
        const account = row.original
        return (
          <div className="flex min-w-0 items-center gap-2.5">
            <AccountAvatar account={account} />
            <div className="min-w-0">
              <div className="truncate font-medium" title={account.name}>
                {account.name}
              </div>
              <div className="truncate text-xs text-muted-foreground">{account.auth_label}</div>
            </div>
          </div>
        )
      },
    },
    {
      id: 'routing',
      header: 'Routing',
      cell: ({ row }) => (
        <>
          <span className={row.original.status === 'active' ? BADGE_ACTIVE : BADGE_PAUSED}>
            {row.original.status === 'active' ? 'Active' : 'Paused'}
          </span>
          <span className="mt-1 block text-xs text-muted-foreground tabular-nums">
            Priority {row.original.priority}
          </span>
        </>
      ),
    },
    {
      id: 'visibility',
      header: 'Quota windows',
      meta: { headerClassName: 'w-[22%]' },
      cell: ({ row }) => (
        <span className="flex items-center gap-2" title={row.original.quota_note}>
          <span
            className={cn(
              'size-1.5 shrink-0 rounded-full',
              VISIBILITY_DOTS[row.original.quota_visibility]
            )}
            aria-hidden
          />
          {VISIBILITY_LABELS[row.original.quota_visibility]}
        </span>
      ),
    },
    {
      id: 'usage',
      header: 'Period usage',
      meta: { cellClassName: 'tabular-nums' },
      cell: ({ row }) => (
        <>
          <span className="block">{formatCount(row.original.requests)} req</span>
          <span className="block text-xs text-muted-foreground">
            {formatCompact(row.original.input_tokens + row.original.output_tokens)} tokens
          </span>
        </>
      ),
    },
    {
      id: 'cost',
      header: 'Cost',
      meta: { cellClassName: 'tabular-nums' },
      cell: ({ row }) => formatUsd(row.original.attributed_cost),
    },
    {
      id: 'actions',
      header: () => <span className="sr-only">Actions</span>,
      meta: { headerClassName: 'w-32' },
      cell: ({ row }) => <ActionCell record={row.original} />,
    },
  ]

  return (
    <SectionCardPanel
      icon={IconUsers}
      title="Accounts"
      toolbar={
        <span className="text-xs text-muted-foreground tabular-nums">
          {accounts.length} {accounts.length === 1 ? 'account' : 'accounts'}
        </span>
      }
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5">
        <FilterQuota filters={filters} onChange={onChange} accounts={accounts} />
      </div>

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/30 px-4 py-2">
          <span className="text-xs font-medium tabular-nums">{selected.size} selected</span>
          <Button
            disabled={toggleMutation.isPending}
            onClick={() => void bulkToggle(true)}
            size="xs"
            variant="outline"
          >
            Pause
          </Button>
          <Button
            disabled={toggleMutation.isPending}
            onClick={() => void bulkToggle(false)}
            size="xs"
            variant="outline"
          >
            Activate
          </Button>
          <Button onClick={() => setSelected(new Set())} size="xs" variant="ghost">
            Clear
          </Button>
        </div>
      )}

      {loading ? (
        <div className="space-y-2 p-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : (
        <ReactTable
          total={total}
          data={paged}
          pageIndex={pageIndex}
          pageSize={pageSize}
          pageSizes={PAGE_SIZES}
          columns={columns}
          tableClassName="min-w-[60rem]"
          emptyMessage={
            <EmptyState
              icon={IconGauge}
              title={accounts.length === 0 ? 'No accounts yet' : 'No accounts match'}
              description={
                accounts.length === 0
                  ? 'Connect a provider account to track its quota here.'
                  : 'Try a different search or filter.'
              }
              className="py-8"
            />
          }
        />
      )}
    </SectionCardPanel>
  )
}

function ActionCell({ record }: { record: Models.QuotaAccount }) {
  const [openDelete, setOpenDelete] = useState(false)
  const toggleMutation = useMutation(queries.quota.toggleStatus())
  const deleteMutation = useMutation(queries.quota.delete())
  const active = record.status === 'active'

  const handleToggle = async (checked: boolean) => {
    try {
      await toggleMutation.mutateAsync(record.id)
      toast.success(`Account ${checked ? 'activated' : 'paused'}`)
    } catch (error) {
      toastAxiosError(error)
    }
  }

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(record.id)
      toast.success('Account deleted')
      setOpenDelete(false)
    } catch (error) {
      toastAxiosError(error)
    }
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <Switch
        aria-label={`${record.name} routing`}
        checked={active}
        disabled={toggleMutation.isPending}
        onCheckedChange={(checked) => void handleToggle(checked)}
        size="sm"
      />
      <RowColumnAction
        noun="account"
        name={record.name}
        onDelete={() => setOpenDelete(true)}
        dropdown={
          <DropdownMenuItem onClick={() => void handleToggle(!active)}>
            {active ? <IconEyeOff /> : <IconPower />}
            {active ? 'Pause account' : 'Activate account'}
          </DropdownMenuItem>
        }
      />

      <SimpleAlertDialog
        confirmText="Delete"
        description={`Account "${record.name}" will be removed from the quota tracker. This cannot be undone.`}
        onConfirm={handleDelete}
        onOpenChange={setOpenDelete}
        open={openDelete}
        title="Delete this account?"
        variant="destructive"
      />
    </div>
  )
}
