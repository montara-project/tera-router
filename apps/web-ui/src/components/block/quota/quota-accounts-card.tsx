import {
  IconDots,
  IconEyeOff,
  IconGauge,
  IconPower,
  IconTrash,
  IconUsers,
} from '@tabler/icons-react'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'

import type { Models } from '@/lib/api/models'

import EmptyState from '@/components/block/common/empty-state'
import SimpleAlertDialog from '@/components/block/common/simple-alert-dialog'
import DashboardPanel from '@/components/block/dashboard/dashboard-panel'
import { getProviderBrand, ProviderAvatar } from '@/components/block/providers/provider-avatar'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
  onPageChange: (pageIndex: number) => void
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
  onPageChange,
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

  const pages = Math.max(1, Math.ceil(total / pageSize))
  const first = total === 0 ? 0 : pageIndex * pageSize + 1
  const last = Math.min(total, (pageIndex + 1) * pageSize)

  return (
    <DashboardPanel
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
      ) : paged.length === 0 ? (
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
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[60rem] text-[13px]">
            <thead className="border-b border-border text-xs text-muted-foreground dark:bg-muted/40">
              <tr>
                <th className="w-10 py-2 pr-1 pl-3">
                  <Checkbox
                    aria-label="Select all rows"
                    checked={
                      allVisibleSelected
                        ? true
                        : selectedVisible.length > 0
                          ? 'indeterminate'
                          : false
                    }
                    onCheckedChange={toggleVisible}
                  />
                </th>
                <th className="w-[31%] px-3 py-2 text-left font-medium">Account</th>
                <th className="px-3 py-2 text-left font-medium">Routing</th>
                <th className="w-[22%] px-3 py-2 text-left font-medium">Quota windows</th>
                <th className="px-3 py-2 text-left font-medium">Period usage</th>
                <th className="px-3 py-2 text-left font-medium">Cost</th>
                <th className="w-32 px-3 py-2">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {paged.map((account) => (
                <tr key={account.id} className="border-b border-border last:border-0">
                  <td className="py-3 pr-1 pl-3 align-top">
                    <Checkbox
                      aria-label={`Select ${account.name}`}
                      checked={selected.has(account.id)}
                      onCheckedChange={() => toggleOne(account.id)}
                    />
                  </td>
                  <td className="max-w-0 p-3">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <AccountAvatar account={account} />
                      <div className="min-w-0">
                        <div className="truncate font-medium" title={account.name}>
                          {account.name}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          {account.auth_label}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="p-3">
                    <span className={account.status === 'active' ? BADGE_ACTIVE : BADGE_PAUSED}>
                      {account.status === 'active' ? 'Active' : 'Paused'}
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground tabular-nums">
                      Priority {account.priority}
                    </span>
                  </td>
                  <td className="p-3">
                    <span className="flex items-center gap-2" title={account.quota_note}>
                      <span
                        className={cn(
                          'size-1.5 shrink-0 rounded-full',
                          VISIBILITY_DOTS[account.quota_visibility]
                        )}
                        aria-hidden
                      />
                      {VISIBILITY_LABELS[account.quota_visibility]}
                    </span>
                  </td>
                  <td className="p-3 tabular-nums">
                    <span className="block">{formatCount(account.requests)} req</span>
                    <span className="block text-xs text-muted-foreground">
                      {formatCompact(account.input_tokens + account.output_tokens)} tokens
                    </span>
                  </td>
                  <td className="p-3 tabular-nums">{formatUsd(account.attributed_cost)}</td>
                  <td className="px-3 py-2.5">
                    <ActionCell record={account} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 ? (
        <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
          <span className="tabular-nums">
            {first}–{last} of {total}
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={pageIndex === 0}
              onClick={() => onPageChange(pageIndex - 1)}
            >
              Previous
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={pageIndex >= pages - 1}
              onClick={() => onPageChange(pageIndex + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </DashboardPanel>
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
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            aria-label={`Actions for ${record.name}`}
            className="size-8 text-muted-foreground hover:text-foreground"
            size="icon"
            variant="ghost"
          >
            <IconDots />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => void handleToggle(!active)}>
            {active ? <IconEyeOff /> : <IconPower />}
            {active ? 'Pause account' : 'Activate account'}
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onSelect={() => setOpenDelete(true)}>
            <IconTrash />
            Delete account
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

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
