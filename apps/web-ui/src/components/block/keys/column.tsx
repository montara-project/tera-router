import type { ColumnDef } from '@tanstack/react-table'

import {
  IconArrowRight,
  IconCheck,
  IconCopy,
  IconEye,
  IconEyeOff,
  IconLink,
  IconTrash,
} from '@tabler/icons-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
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
import { throwAxiosError } from '@/lib/api/axios-error'
import { KEY_QUERY_KEY } from '@/lib/api/queries/key'
import { services } from '@/lib/api/services'

type ColumnType = ColumnDef<typeof features, Models.ApiKey, unknown>

const STATUS_DOTS: Record<Models.ApiKeyStatus, string> = {
  active: 'bg-emerald-500 text-emerald-500',
  disabled: 'bg-zinc-400 text-zinc-400',
  restricted: 'bg-amber-500 text-amber-500',
}

function formatKeyDate(iso: string) {
  const date = new Date(iso)
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')

  return `${day}/${month}/${date.getFullYear()}`
}

function KeyCopyCell({ record }: { record: Models.ApiKey }) {
  const { copied, copy } = useCopyToClipboard()

  return (
    <div className="flex items-center gap-2">
      <IconLink className="h-4 w-4 shrink-0 text-muted-foreground" />
      <code className="font-mono text-sm">{record.keyPreview}</code>
      <Button
        aria-label={`Copy ${record.name} key`}
        className="text-muted-foreground hover:text-foreground"
        mode="icon"
        onClick={() => copy(record.fullKey)}
        size="sm"
        variant="ghost"
      >
        {copied ? <IconCheck className="text-emerald-600 dark:text-emerald-300" /> : <IconCopy />}
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
              Select all ({table.getFilteredRowModel().rows.length})
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
        size: 120,
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
                Created {formatKeyDate(row.original.createdAt)}
              </div>
            </div>
          )
        },
      },
      {
        accessorKey: 'keyPreview',
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
        accessorKey: 'planLabel',
        header: 'Access',
        size: 150,
        cell: ({ row }) => {
          return loading ? (
            <Skeleton className="h-5 w-full" />
          ) : (
            <div className="text-sm">
              <span className="font-semibold">{row.original.planLabel}</span>
              <span className="text-muted-foreground"> · {row.original.planNote}</span>
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
        cell: () => {
          return loading ? (
            <Skeleton className="h-5 w-full" />
          ) : (
            <Button variant="outline">
              <span>Details</span>
              <IconArrowRight />
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

  const queryClient = useQueryClient()

  const invalidateAll = () => queryClient.invalidateQueries({ queryKey: [KEY_QUERY_KEY] })

  const toggleMutation = useMutation({
    mutationFn: async () => {
      try {
        await services.keys.toggleStatus(record.id)
      } catch (error) {
        throwAxiosError(error as Error)
      }
    },
    onSuccess: () => {
      toast.success(`Key ${record.status === 'active' ? 'disabled' : 'enabled'}`)
      return invalidateAll()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async () => {
      try {
        await services.keys.remove(record.id)
      } catch (error) {
        throwAxiosError(error as Error)
      }
    },
    onSuccess: () => {
      toast.success('Key deleted')
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
