import { EyeOff, Power, Trash2 } from 'lucide-react'
import React, { useState } from 'react'

import type { Models } from '@/lib/api/models'

import SimpleAlertDialog from '@/components/block/common/simple-alert-dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'

import { formatCompactNumber, formatCost } from './quota-formatters'

interface QuotaAccountsTableProps {
  accounts: Models.QuotaAccount[]
  loading?: boolean
  togglingId?: string | null
  onToggle: (account: Models.QuotaAccount) => void
  onDelete: (account: Models.QuotaAccount) => void
}

const VISIBILITY_DOTS: Record<Models.QuotaAccount['quotaVisibility'], string> = {
  'quota-capable': 'bg-emerald-500',
  'usage-only': 'bg-zinc-500',
  'not-reported': 'bg-amber-500',
}

function visibilityLabel(visibility: Models.QuotaAccount['quotaVisibility']) {
  const label = visibility.replace('-', ' ')

  return label.charAt(0).toUpperCase() + label.slice(1)
}

function AccountAvatar({ account }: { account: Models.QuotaAccount }) {
  return (
    <span
      className={
        account.brandAvatar
          ? 'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-orange-500 text-sm font-bold text-white'
          : 'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-sidebar-accent text-xs font-semibold text-muted-foreground'
      }
    >
      {account.initials}
    </span>
  )
}

interface RowActionsProps {
  account: Models.QuotaAccount
  toggling: boolean
  onToggle: (account: Models.QuotaAccount) => void
  onDelete: (account: Models.QuotaAccount) => void
}

function RowActions({ account, toggling, onToggle, onDelete }: RowActionsProps) {
  const [openDelete, setOpenDelete] = useState(false)

  return (
    <React.Fragment>
      <div className="flex items-center justify-end gap-1">
        <Button
          aria-label={account.status === 'active' ? 'Pause account' : 'Activate account'}
          className="text-muted-foreground hover:text-foreground"
          disabled={toggling}
          onClick={() => onToggle(account)}
          size="icon"
          variant="ghost"
        >
          {account.status === 'active' ? <EyeOff /> : <Power />}
        </Button>
        <Button
          aria-label="Delete account"
          className="text-muted-foreground hover:text-foreground"
          onClick={() => setOpenDelete(true)}
          size="icon"
          variant="ghost"
        >
          <Trash2 />
        </Button>
      </div>

      <SimpleAlertDialog
        confirmText="Delete"
        description={`Account "${account.name}" will be removed from the quota tracker. This cannot be undone.`}
        onConfirm={() => onDelete(account)}
        onOpenChange={setOpenDelete}
        open={openDelete}
        title="Do you want to delete this account?"
        variant="destructive"
      />
    </React.Fragment>
  )
}

export default function QuotaAccountsTable({
  accounts,
  loading = false,
  togglingId = null,
  onToggle,
  onDelete,
}: QuotaAccountsTableProps) {
  const [selected, setSelected] = useState<Record<string, boolean>>({})

  const selectedCount = accounts.filter((account) => selected[account.id]).length
  const allSelected = accounts.length > 0 && selectedCount === accounts.length

  const toggleAll = () => {
    const next: Record<string, boolean> = {}
    if (!allSelected) {
      for (const account of accounts) {
        next[account.id] = true
      }
    }
    setSelected(next)
  }

  const toggleOne = (id: string) => {
    setSelected((previous) => ({ ...previous, [id]: !previous[id] }))
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="w-12 px-5 py-3">
              <Checkbox
                aria-label="Select all accounts"
                checked={allSelected ? true : selectedCount > 0 ? 'indeterminate' : false}
                onCheckedChange={toggleAll}
                size="sm"
              />
            </th>
            <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-muted-foreground uppercase">
              Provider / Account
            </th>
            <th className="w-32 px-3 py-3 text-left text-xs font-medium tracking-wider text-muted-foreground whitespace-nowrap uppercase">
              Routing
            </th>
            <th className="w-72 px-3 py-3 text-left text-xs font-medium tracking-wider text-muted-foreground whitespace-nowrap uppercase">
              Quota Visibility
            </th>
            <th className="w-36 px-3 py-3 text-right text-xs font-medium tracking-wider text-muted-foreground whitespace-nowrap uppercase">
              Period Usage
            </th>
            <th className="w-36 px-3 py-3 text-right text-xs font-medium tracking-wider text-muted-foreground whitespace-nowrap uppercase">
              Attributed Cost
            </th>
            <th className="w-28 px-5 py-3 text-right text-xs font-medium tracking-wider text-muted-foreground whitespace-nowrap uppercase">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {loading && accounts.length === 0
            ? Array.from({ length: 5 }, (_, index) => (
                <tr key={index} className="border-b border-border last:border-b-0">
                  {Array.from({ length: 7 }, (_, cell) => (
                    <td key={cell} className="px-5 py-4">
                      <Skeleton className="h-5 w-full" />
                    </td>
                  ))}
                </tr>
              ))
            : accounts.map((account) => (
                <tr
                  key={account.id}
                  className="border-b border-border transition-colors last:border-b-0 hover:bg-accent/40"
                >
                  <td className="px-5 py-4">
                    <Checkbox
                      aria-label={`Select ${account.name}`}
                      checked={Boolean(selected[account.id])}
                      onCheckedChange={() => toggleOne(account.id)}
                      size="sm"
                    />
                  </td>

                  <td className="px-3 py-4">
                    <div className="flex items-center gap-3">
                      <AccountAvatar account={account} />
                      <div className="min-w-0">
                        <div className="truncate font-medium">{account.name}</div>
                        <div className="text-muted-foreground truncate text-xs">
                          {account.authLabel}
                        </div>
                      </div>
                    </div>
                  </td>

                  <td className="px-3 py-4">
                    {account.status === 'active' ? (
                      <span className="inline-flex rounded-md bg-emerald-950/40 px-2 py-0.5 text-xs font-medium text-emerald-400 ring-1 ring-emerald-900/60 ring-inset">
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex rounded-md bg-zinc-800/60 px-2 py-0.5 text-xs font-medium text-zinc-400 ring-1 ring-zinc-700/60 ring-inset">
                        Paused
                      </span>
                    )}
                    <div className="text-muted-foreground mt-1 text-xs">
                      Priority {account.priority}
                    </div>
                  </td>

                  <td className="px-3 py-4">
                    <div className="flex items-center gap-2">
                      <span
                        className={`size-1.5 shrink-0 rounded-full ${VISIBILITY_DOTS[account.quotaVisibility]}`}
                      />
                      <span className="font-medium">
                        {visibilityLabel(account.quotaVisibility)}
                      </span>
                    </div>
                    <div className="text-muted-foreground mt-1 text-xs">{account.quotaNote}</div>
                  </td>

                  <td className="px-3 py-4 text-right">
                    <div className="font-semibold tabular-nums">
                      {account.requests}{' '}
                      <span className="text-muted-foreground font-normal">req</span>
                    </div>
                    <div className="text-muted-foreground text-xs tabular-nums">
                      {formatCompactNumber(account.inputTokens + account.outputTokens)} tokens
                    </div>
                  </td>

                  <td className="px-3 py-4 text-right font-semibold tabular-nums">
                    {formatCost(account.attributedCost)}
                  </td>

                  <td className="px-5 py-4">
                    <RowActions
                      account={account}
                      onDelete={onDelete}
                      onToggle={onToggle}
                      toggling={togglingId === account.id}
                    />
                  </td>
                </tr>
              ))}
        </tbody>
      </table>
    </div>
  )
}
