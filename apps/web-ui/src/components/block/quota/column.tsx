import type { ColumnDef } from '@tanstack/react-table'

import { IconDots, IconEyeOff, IconPower, IconTrash } from '@tabler/icons-react'
import { useMutation } from '@tanstack/react-query'
import { Fragment, useMemo, useState } from 'react'
import { toast } from 'sonner'

import type { Models } from '@/lib/api/models'
import type { BaseColumnProps } from '@/types/column'

import { features } from '@/components/block/common/react-table'
import SimpleAlertDialog from '@/components/block/common/simple-alert-dialog'
import { Button } from '@/components/ui/button'
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
      className={cn(
        'flex h-6 w-6 shrink-0 items-center justify-center rounded border border-border bg-muted/50 font-mono text-[10px] font-medium text-muted-foreground',
        account.brand_avatar && 'border-0 bg-orange-500 text-white'
      )}
    >
      {account.initials}
    </span>
  )
}

const BADGE_ACTIVE =
  'inline-flex h-5 items-center rounded-md border border-emerald-500/20 bg-emerald-500/10 px-1.5 text-[11.5px] font-medium text-emerald-600 dark:text-emerald-400'
const BADGE_PAUSED =
  'inline-flex h-5 items-center rounded-md border border-border bg-muted/40 px-1.5 text-[11.5px] font-medium text-muted-foreground'

export function QuotaAccountColumn({ loading }: BaseColumnProps) {
  const columns = useMemo<ColumnType[]>(() => {
    return [
      {
        accessorKey: 'name',
        header: 'Account',
        size: 380,
        cell: ({ row }) => {
          return loading ? (
            <Skeleton className="h-5 w-full" />
          ) : (
            <div className="flex min-w-0 items-center gap-2.5">
              <AccountAvatar account={row.original} />
              <div className="min-w-0">
                <div className="truncate text-[13px] font-medium">{row.original.name}</div>
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
        header: 'Routing',
        size: 140,
        cell: ({ row }) => {
          return loading ? (
            <Skeleton className="h-5 w-full" />
          ) : (
            <div className="flex flex-col gap-1">
              <span className={row.original.status === 'active' ? BADGE_ACTIVE : BADGE_PAUSED}>
                {row.original.status === 'active' ? 'Active' : 'Paused'}
              </span>
              <span className="text-muted-foreground text-xs tabular-nums">
                Priority {row.original.priority}
              </span>
            </div>
          )
        },
      },
      {
        accessorKey: 'quota_visibility',
        header: 'Quota windows',
        size: 300,
        cell: ({ row }) => {
          return loading ? (
            <Skeleton className="h-5 w-full" />
          ) : (
            <div className="flex items-center gap-2">
              <span
                className={`size-1.5 shrink-0 rounded-full ${VISIBILITY_DOTS[row.original.quota_visibility]}`}
              />
              <span className="text-[13px]">{visibilityLabel(row.original.quota_visibility)}</span>
            </div>
          )
        },
      },
      {
        accessorKey: 'requests',
        header: 'Period usage',
        size: 150,
        cell: ({ row }) => {
          return loading ? (
            <Skeleton className="h-5 w-full" />
          ) : (
            <div className="text-right">
              <div className="text-[13px] tabular-nums">
                {formatCount(row.original.requests)} req
              </div>
              <div className="text-muted-foreground text-xs tabular-nums">
                {formatCompact(row.original.input_tokens + row.original.output_tokens)} tokens
              </div>
            </div>
          )
        },
      },
      {
        accessorKey: 'attributed_cost',
        header: 'Cost',
        size: 110,
        cell: ({ row }) => {
          return loading ? (
            <Skeleton className="h-5 w-full" />
          ) : (
            <div className="text-right text-[13px] tabular-nums">
              {formatUsd(row.original.attributed_cost)}
            </div>
          )
        },
      },
      {
        accessorKey: 'actions',
        header: '',
        size: 160,
        cell: ({ row }) => {
          return loading ? (
            <Skeleton className="h-5 w-full" />
          ) : (
            <ActionCell record={row.original} />
          )
        },
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

  const handleToggle = async (checked: boolean) => {
    try {
      await toggleMutation.mutateAsync(record.id)
      toast.success(`Account ${checked ? 'activated' : 'paused'}`)
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

  const active = record.status === 'active'

  return (
    <Fragment>
      <div className="flex items-center justify-end gap-1">
        <Switch
          aria-label={active ? 'Pause account' : 'Activate account'}
          checked={active}
          className="data-[state=checked]:bg-blue-500"
          disabled={toggleMutation.isPending}
          onCheckedChange={handleToggle}
          size="sm"
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              aria-label="More actions"
              className="text-muted-foreground size-8 hover:text-foreground"
              size="icon"
              variant="ghost"
            >
              <IconDots />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onSelect={() => {
                void handleToggle(!active)
              }}
            >
              {active ? <IconEyeOff /> : <IconPower />}
              {active ? 'Pause account' : 'Activate account'}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setOpenDelete(true)}>
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
          title="Do you want to delete this account?"
          variant="destructive"
        />
      </div>
    </Fragment>
  )
}
