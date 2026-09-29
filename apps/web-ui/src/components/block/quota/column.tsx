import type { ColumnDef } from '@tanstack/react-table'

import { useMutation } from '@tanstack/react-query'
import { EyeOff, Power, Trash2 } from 'lucide-react'
import React, { useMemo, useState } from 'react'
import { toast } from 'sonner'

import type { Models } from '@/lib/api/models'
import type { BaseColumnProps } from '@/types/column'

import { features } from '@/components/block/common/react-table'
import SimpleAlertDialog from '@/components/block/common/simple-alert-dialog'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { toastAxiosError } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'

import { formatCompactNumber, formatCost } from './quota-formatters'

type ColumnType = ColumnDef<typeof features, Models.QuotaAccount, unknown>

const VISIBILITY_DOTS: Record<Models.QuotaAccount['quota_visibility'], string> = {
  'quota-capable': 'bg-emerald-500',
  'usage-only': 'bg-zinc-500',
  'not-reported': 'bg-amber-500',
}

function visibilityLabel(visibility: Models.QuotaAccount['quota_visibility']) {
  const label = visibility.replace('-', ' ')

  return label.charAt(0).toUpperCase() + label.slice(1)
}

function AccountAvatar({ account }: { account: Models.QuotaAccount }) {
  return (
    <span
      className={
        account.brand_avatar
          ? 'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-orange-500 text-sm font-bold text-white'
          : 'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-sidebar-accent text-xs font-semibold text-muted-foreground'
      }
    >
      {account.initials}
    </span>
  )
}

export function QuotaAccountColumn({ loading }: BaseColumnProps) {
  const columns = useMemo<ColumnType[]>(() => {
    return [
      {
        accessorKey: 'name',
        header: 'Account',
        size: 180,
        cell: ({ row }) => {
          return loading ? (
            <Skeleton className="h-5 w-full" />
          ) : (
            <div className="flex items-center gap-3">
              <AccountAvatar account={row.original} />
              <div className="min-w-0">
                <div className="truncate font-medium">{row.original.name}</div>
                <div className="text-muted-foreground truncate text-xs">
                  {row.original.auth_label}
                </div>
              </div>
            </div>
          )
        },
      },
      {
        accessorKey: 'status',
        header: 'Status',
        size: 100,
        cell: ({ row }) => {
          return loading ? (
            <Skeleton className="h-5 w-full" />
          ) : (
            <div>
              {row.original.status === 'active' ? (
                <span className="inline-flex rounded-md bg-emerald-950/40 px-2 py-0.5 text-xs font-medium text-emerald-400 ring-1 ring-emerald-900/60 ring-inset">
                  Active
                </span>
              ) : (
                <span className="inline-flex rounded-md bg-zinc-800/60 px-2 py-0.5 text-xs font-medium text-zinc-400 ring-1 ring-zinc-700/60 ring-inset">
                  Paused
                </span>
              )}
              <div className="text-muted-foreground mt-1 text-xs">
                Priority {row.original.priority}
              </div>
            </div>
          )
        },
      },
      {
        accessorKey: 'quota_visibility',
        header: 'Quota Visibility',
        size: 180,
        cell: ({ row }) => {
          return loading ? (
            <Skeleton className="h-5 w-full" />
          ) : (
            <div>
              <div className="flex items-center gap-2">
                <span
                  className={`size-1.5 shrink-0 rounded-full ${VISIBILITY_DOTS[row.original.quota_visibility]}`}
                />
                <span className="font-medium">
                  {visibilityLabel(row.original.quota_visibility)}
                </span>
              </div>
              <div className="text-muted-foreground mt-1 text-xs">{row.original.quota_note}</div>
            </div>
          )
        },
      },
      {
        accessorKey: 'requests',
        header: 'Period Usage',
        size: 120,
        cell: ({ row }) => {
          return loading ? (
            <Skeleton className="h-5 w-full" />
          ) : (
            <div className="text-right">
              <div className="font-semibold tabular-nums">
                {row.original.requests}{' '}
                <span className="text-muted-foreground font-normal">req</span>
              </div>
              <div className="text-muted-foreground text-xs tabular-nums">
                {formatCompactNumber(row.original.input_tokens + row.original.output_tokens)} tokens
              </div>
            </div>
          )
        },
      },
      {
        accessorKey: 'attributed_cost',
        header: 'Attributed Cost',
        size: 120,
        cell: ({ row }) => {
          return loading ? (
            <Skeleton className="h-5 w-full" />
          ) : (
            <div className="text-right font-semibold tabular-nums">
              {formatCost(row.original.attributed_cost)}
            </div>
          )
        },
      },
      {
        accessorKey: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
          return loading ? (
            <Skeleton className="h-5 w-full" />
          ) : (
            <ActionCell record={row.original} />
          )
        },
        size: 100,
      },
    ]
  }, [loading])

  return columns
}

interface ActionCellProps {
  record: Models.QuotaAccount
}

function ActionCell({ record }: ActionCellProps) {
  const [openDelete, setOpenDelete] = useState(false)

  const toggleMutation = useMutation(queries.quota.toggleStatus())
  const deleteMutation = useMutation(queries.quota.delete())

  const handleToggle = async () => {
    try {
      await toggleMutation.mutateAsync(record.id)
      toast.success(`Account ${record.status === 'active' ? 'paused' : 'activated'}`)
    } catch (error) {
      toastAxiosError(error as Error)
    }
  }

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(record.id)
      toast.success('Account deleted')
      setOpenDelete(false)
    } catch (error) {
      toastAxiosError(error as Error)
    }
  }

  return (
    <React.Fragment>
      <div className="flex items-center justify-end gap-1">
        <Button
          aria-label={record.status === 'active' ? 'Pause account' : 'Activate account'}
          className="text-muted-foreground hover:text-foreground"
          disabled={toggleMutation.isPending}
          mode="icon"
          onClick={() => handleToggle()}
          size="icon"
          variant="ghost"
        >
          {record.status === 'active' ? <EyeOff /> : <Power />}
        </Button>
        <Button
          aria-label="Delete account"
          className="text-muted-foreground hover:text-foreground"
          mode="icon"
          onClick={() => setOpenDelete(true)}
          size="icon"
          variant="ghost"
        >
          <Trash2 />
        </Button>
      </div>

      <SimpleAlertDialog
        confirmText="Delete"
        description={`Account "${record.name}" will be removed from the quota tracker. This cannot be undone.`}
        onConfirm={handleDelete}
        onOpenChange={setOpenDelete}
        open={openDelete}
        title="Do you want to delete this account?"
        variant="destructive"
      />
    </React.Fragment>
  )
}
