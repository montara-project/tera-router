import type { ColumnDef } from '@tanstack/react-table'

import { IconStack2 } from '@tabler/icons-react'
import { useMutation } from '@tanstack/react-query'
import { ChevronDown, ChevronUp } from 'lucide-react'
import pluralize from 'pluralize'
import React, { useMemo, useState } from 'react'
import { toast } from 'sonner'

import type { Models } from '@/lib/api/models'
import type { BaseColumnProps } from '@/types/column'

import { Badge, BadgeDot } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { toastAxiosError } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'
import { capitalizeFirstLetter } from '@/lib/string'
import { cn } from '@/lib/utils'

import { features } from '../../common/react-table'
import RowColumnAction from '../../common/row-column-action'
import SimpleAlertDialog from '../../common/simple-alert-dialog'
import ChainGroup from './chain-group'
import ChainStepRow from './chain-step-row'

type ColumnType = ColumnDef<typeof features, Models.Chain, unknown>

type ChainColumnProps = BaseColumnProps & {
  onEdit?: (chain: Models.Chain) => void
}

export function ChainColumn({ loading, onEdit }: ChainColumnProps) {
  const columns = useMemo<ColumnType[]>(() => {
    return [
      {
        accessorKey: 'name',
        header: 'Name',
        cell: ({ row }) => {
          return loading ? (
            <Skeleton className="h-5 w-full" />
          ) : (
            <ChainGroup
              title={row.original.name}
              description={`chain:${row.original.name}`}
              icon={IconStack2}
              tone="info"
            />
          )
        },
      },
      {
        accessorKey: 'route',
        header: 'Route',
        cell: ({ row }) => {
          const total = capitalizeFirstLetter(pluralize('model', row.original.steps.length, true))
          return row.getCanExpand() ? (
            <div className="flex items-center gap-2">
              <Button
                {...{
                  size: 'sm',
                  className: cn(
                    'bg-blue-50 ring-blue-200/70 dark:bg-blue-950/30 dark:ring-blue-900/60',
                    'text-neutral-100'
                  ),
                  onClick: row.getToggleExpandedHandler(),
                }}
              >
                {capitalizeFirstLetter(row.original.strategy)}
                {row.getIsExpanded() ? <ChevronUp /> : <ChevronDown />}
              </Button>
              <span className="text-muted-foreground text-xs">{total}</span>
            </div>
          ) : null
        },
        meta: {
          expandedContent: (row) => <ChainStepRow row={row} />,
        },
      },
      {
        accessorKey: 'enabled',
        header: 'Status',
        cell: ({ row }) => {
          if (loading) {
            return <Skeleton className="h-5 w-full" />
          }

          return (
            <Badge
              variant={row.original.enabled ? 'success' : 'secondary'}
              appearance="light"
              size="sm"
            >
              <BadgeDot />
              {row.original.enabled ? 'Active' : 'Inactive'}
            </Badge>
          )
        },
        size: 110,
      },
      {
        accessorKey: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
          return loading ? (
            <Skeleton className="h-5 w-full" />
          ) : (
            <ActionCell record={row.original} onEdit={onEdit} />
          )
        },
        size: 50,
      },
    ]
  }, [loading, onEdit])

  return columns
}

interface ActionCellProps {
  record: Models.Chain
  onEdit?: (chain: Models.Chain) => void
}

function ActionCell({ record, onEdit }: ActionCellProps) {
  const [openDelete, setOpenDelete] = useState(false)

  const deleteMutation = useMutation(queries.chains.delete())

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(record.id)
      toast.success('Chain deleted successfully')
      setOpenDelete(false)
    } catch (error) {
      toastAxiosError(error as Error)
    }
  }

  return (
    <React.Fragment>
      <RowColumnAction onEdit={onEdit ? () => onEdit(record) : undefined} onDelete={() => setOpenDelete(true)} />

      <SimpleAlertDialog
        title="Do you want to delete this chain?"
        description="This chain will be permanently deleted and cannot be undone."
        open={openDelete}
        onOpenChange={setOpenDelete}
        onConfirm={handleDelete}
        confirmText="Delete"
        variant="destructive"
      />
    </React.Fragment>
  )
}
