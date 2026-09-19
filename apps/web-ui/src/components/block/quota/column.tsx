import type { ColumnDef } from '@tanstack/react-table'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { EyeOff, Power, Trash2 } from 'lucide-react'
import React, { useMemo, useState } from 'react'
import { toast } from 'sonner'

import type { Models } from '@/lib/api/models'
import type { BaseColumnProps } from '@/types/column'

import { features } from '@/components/block/common/react-table'
import SimpleAlertDialog from '@/components/block/common/simple-alert-dialog'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { throwAxiosError } from '@/lib/api/axios-error'
import { QUOTA_QUERY_KEY } from '@/lib/api/queries/quota'
import { services } from '@/lib/api/services'

import { formatCompactNumber, formatCost } from './quota-formatters'

type ColumnType = ColumnDef<typeof features, Models.QuotaAccount, unknown>

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
                  {row.original.authLabel}
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
        accessorKey: 'quotaVisibility',
        header: 'Quota Visibility',
        size: 180,
        cell: ({ row }) => {
          return loading ? (
            <Skeleton className="h-5 w-full" />
          ) : (
            <div>
              <div className="flex items-center gap-2">
                <span
                  className={`size-1.5 shrink-0 rounded-full ${VISIBILITY_DOTS[row.original.quotaVisibility]}`}
                />
                <span className="font-medium">{visibilityLabel(row.original.quotaVisibility)}</span>
              </div>
              <div className="text-muted-foreground mt-1 text-xs">{row.original.quotaNote}</div>
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
                {formatCompactNumber(row.original.inputTokens + row.original.outputTokens)} tokens
              </div>
            </div>
          )
        },
      },
      {
        accessorKey: 'attributedCost',
        header: 'Attributed Cost',
        size: 120,
        cell: ({ row }) => {
          return loading ? (
            <Skeleton className="h-5 w-full" />
          ) : (
            <div className="text-right font-semibold tabular-nums">
              {formatCost(row.original.attributedCost)}
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

  const queryClient = useQueryClient()

  const invalidateAll = () => queryClient.invalidateQueries({ queryKey: [QUOTA_QUERY_KEY] })

  const toggleMutation = useMutation({
    mutationFn: async () => {
      try {
        await services.quota.toggleStatus(record.id)
      } catch (error) {
        throwAxiosError(error as Error)
      }
    },
    onSuccess: () => {
      toast.success(`Account ${record.status === 'active' ? 'paused' : 'activated'}`)
      return invalidateAll()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async () => {
      try {
        await services.quota.remove(record.id)
      } catch (error) {
        throwAxiosError(error as Error)
      }
    },
    onSuccess: () => {
      toast.success('Account deleted')
      setOpenDelete(false)
      return invalidateAll()
    },
  })

  const handleToggle = async () => {
    try {
      await toggleMutation.mutateAsync()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'An error occurred'
      toast.error(message)
    }
  }

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'An error occurred'
      toast.error(message)
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
