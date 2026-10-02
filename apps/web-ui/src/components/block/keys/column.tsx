import type { ColumnDef } from '@tanstack/react-table'

import {
  IconArrowRight,
  IconCheck,
  IconCopy,
  IconEye,
  IconEyeOff,
  IconLink,
  IconLoader2,
  IconTrash,
} from '@tabler/icons-react'
import { useMutation } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import React, { useMemo, useState } from 'react'
import { toast } from 'sonner'

import type { Models } from '@/lib/api/models'
import type { BaseColumnProps } from '@/types/column'

import { features } from '@/components/block/common/react-table'
import SimpleAlertDialog from '@/components/block/common/simple-alert-dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
import { toastAxiosError } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'
import { formatDate } from '@/lib/date'

type ColumnType = ColumnDef<typeof features, Models.ApiKey, unknown>

const STATUS_DOTS: Record<Models.ApiKeyStatus, string> = {
  active: 'bg-emerald-500 text-emerald-500',
  disabled: 'bg-zinc-400 text-zinc-400',
  restricted: 'bg-amber-500 text-amber-500',
}

function KeyCopyCell({ record }: { record: Models.ApiKey }) {
  const { copied, copy } = useCopyToClipboard()
  const revealMutation = useMutation(queries.keys.reveal())

  // The list payload only carries the masked preview, so copying the real
  // credential goes through the audit-logged reveal endpoint (same as the
  // detail page). An optional full_key — e.g. right after creation — skips it.
  const handleCopy = async () => {
    if (record.full_key) {
      copy(record.full_key)
      return
    }
    try {
      const res = await revealMutation.mutateAsync(record.id)
      copy(res.data.full_key)
    } catch (error) {
      toastAxiosError(error)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <IconLink className="h-4 w-4 shrink-0 text-muted-foreground" />
      <code className="font-mono text-sm">{record.key_preview}</code>
      <Button
        aria-label={copied ? `Copied ${record.name} key` : `Copy ${record.name} key`}
        className="text-muted-foreground hover:text-foreground"
        disabled={revealMutation.isPending}
        mode="icon"
        onClick={() => void handleCopy()}
        size="sm"
        variant="ghost"
      >
        {revealMutation.isPending ? (
          <IconLoader2 className="animate-spin" />
        ) : copied ? (
          <IconCheck className="text-emerald-600 dark:text-emerald-300" />
        ) : (
          <IconCopy />
        )}
      </Button>
    </div>
  )
}

export function KeysColumn({ loading }: BaseColumnProps) {
  const columns = useMemo<ColumnType[]>(() => {
    return [
      {
        id: 'select',
        header: ({ table }) => (
          <div className="flex items-center gap-2.5">
            <Checkbox
              aria-label="Select all keys"
              checked={
                table.getIsAllPageRowsSelected()
                  ? true
                  : table.getIsSomePageRowsSelected()
                    ? 'indeterminate'
                    : false
              }
              onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
              size="sm"
            />
            <span className="text-muted-foreground text-xs whitespace-nowrap">
              keys ({table.getFilteredRowModel().rows.length})
            </span>
          </div>
        ),
        cell: ({ row }) => (
          <Checkbox
            aria-label={`Select ${row.original.name}`}
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            size="sm"
          />
        ),
        enableSorting: false,
        size: 70,
      },
      {
        accessorKey: 'name',
        header: 'Key',
        size: 140,
        cell: ({ row }) => {
          return loading ? (
            <Skeleton className="h-5 w-full" />
          ) : (
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{row.original.name}</span>
                <span
                  className={`inline-flex items-center gap-1.5 text-xs font-medium ${STATUS_DOTS[row.original.status].split(' ')[1]}`}
                >
                  <span
                    className={`size-1.5 rounded-full ${STATUS_DOTS[row.original.status].split(' ')[0]}`}
                  />
                  {row.original.status.charAt(0).toUpperCase() + row.original.status.slice(1)}
                </span>
              </div>
              <div className="text-muted-foreground mt-0.5 text-xs">
                Created {formatDate(row.original.created_at)}
              </div>
            </div>
          )
        },
      },
      {
        accessorKey: 'key_preview',
        header: 'Identifier',
        size: 210,
        cell: ({ row }) => {
          return loading ? (
            <Skeleton className="h-5 w-full" />
          ) : (
            <KeyCopyCell record={row.original} />
          )
        },
      },
      {
        accessorKey: 'plan_label',
        header: 'Access',
        size: 150,
        cell: ({ row }) => {
          return loading ? (
            <Skeleton className="h-5 w-full" />
          ) : (
            <div className="text-sm">
              <span className="font-semibold">{row.original.plan_label}</span>
              <span className="text-muted-foreground"> · {row.original.plan_note}</span>
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
      {
        id: 'details',
        header: '',
        cell: ({ row }) => {
          return loading ? (
            <Skeleton className="h-5 w-full" />
          ) : (
            <Button asChild variant="outline">
              <Link params={{ keyId: row.original.id }} to="/keys/$keyId">
                <span>Details</span>
                <IconArrowRight />
              </Link>
            </Button>
          )
        },
        size: 110,
      },
    ]
  }, [loading])

  return columns
}

interface ActionCellProps {
  record: Models.ApiKey
}

function ActionCell({ record }: ActionCellProps) {
  const [openDelete, setOpenDelete] = useState(false)

  const toggleMutation = useMutation(queries.keys.toggleStatus())
  const deleteMutation = useMutation(queries.keys.delete())

  const handleToggle = async () => {
    const disabled = record.status === 'active'
    try {
      await toggleMutation.mutateAsync({ id: record.id, disabled })
      toast.success(`Key ${disabled ? 'disabled' : 'enabled'}`)
    } catch (error) {
      toastAxiosError(error)
    }
  }

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(record.id)
      toast.success('Key deleted')
      setOpenDelete(false)
    } catch (error) {
      toastAxiosError(error)
    }
  }

  return (
    <React.Fragment>
      <div className="flex items-center gap-1">
        <Button
          aria-label={record.status === 'active' ? 'Disable key' : 'Enable key'}
          className="text-muted-foreground hover:text-foreground"
          disabled={toggleMutation.isPending}
          mode="icon"
          onClick={() => handleToggle()}
          size="icon"
          variant="ghost"
        >
          {record.status === 'active' ? <IconEyeOff /> : <IconEye />}
        </Button>
        <Button
          aria-label="Delete key"
          className="text-muted-foreground hover:text-foreground"
          mode="icon"
          onClick={() => setOpenDelete(true)}
          size="icon"
          variant="ghost"
        >
          <IconTrash />
        </Button>
      </div>

      <SimpleAlertDialog
        confirmText="Delete"
        description={`Key "${record.name}" will be permanently deleted. Applications using it will stop authenticating.`}
        onConfirm={handleDelete}
        onOpenChange={setOpenDelete}
        open={openDelete}
        title="Do you want to delete this key?"
        variant="destructive"
      />
    </React.Fragment>
  )
}
