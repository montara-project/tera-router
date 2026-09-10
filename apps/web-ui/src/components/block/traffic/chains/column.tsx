import type { ColumnDef } from '@tanstack/react-table'

import { IconStack2 } from '@tabler/icons-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, ChevronUp } from 'lucide-react'
import pluralize from 'pluralize'
import React, { useMemo, useState } from 'react'
import { toast } from 'sonner'

import type { Models } from '@/lib/api/models'
import type { BaseColumnProps } from '@/types/column'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { usePaginationQuery } from '@/hooks/use-pagination-query'
import { throwAxiosError } from '@/lib/api/axios-error'
import { CHAIN_QUERY_KEY } from '@/lib/api/queries/chain'
import { services } from '@/lib/api/services'
import { capitalizeFirstLetter } from '@/lib/string'
import { cn } from '@/lib/utils'

import { features } from '../../common/react-table'
import RowColumnAction from '../../common/row-column-action'
import SimpleAlertDialog from '../../common/simple-alert-dialog'
import ChainGroup from './chain-group'
import ChainStepRow from './chain-step-row'

type ColumnType = ColumnDef<typeof features, Models.Chain, unknown>

export function ChainColumn({ loading }: BaseColumnProps) {
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
        accessorKey: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
          return loading ? (
            <Skeleton className="h-5 w-full" />
          ) : (
            <ActionCell record={row.original} />
          )
        },
        size: 50,
      },
    ]
  }, [loading])

  return columns
}

interface ActionCellProps {
  record: Models.Chain
}

function ActionCell({ record }: ActionCellProps) {
  const [openDelete, setOpenDelete] = useState(false)

  const queryClient = useQueryClient()
  const { offset, limit } = usePaginationQuery()

  const mutation = useMutation({
    mutationFn: async () => {
      try {
        await services.chains.delete(record.id)
      } catch (error) {
        throwAxiosError(error as Error)
      }
    },
    onSuccess: () => {
      toast.success('Chain deleted successfully')
      queryClient.invalidateQueries({
        queryKey: [CHAIN_QUERY_KEY, { offset, limit }],
      })
      setOpenDelete(false)
    },
  })

  const handleDelete = async () => {
    try {
      await mutation.mutateAsync()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'An error occurred'
      toast.error(message)
    }
  }

  return (
    <React.Fragment>
      <RowColumnAction onEdit={() => console.log('edit')} onDelete={() => setOpenDelete(true)} />

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
