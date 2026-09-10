import type { ColumnDef } from '@tanstack/react-table'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import React, { useMemo, useState } from 'react'
import { toast } from 'sonner'

import type { Models } from '@/lib/api/models'
import type { BaseColumnProps } from '@/types/column'

import { Skeleton } from '@/components/ui/skeleton'
import { usePaginationQuery } from '@/hooks/use-pagination-query'
import { throwAxiosError } from '@/lib/api/axios-error'
import { CHAIN_QUERY_KEY } from '@/lib/api/queries/chain'
import { services } from '@/lib/api/services'

import { features } from '../../common/react-table'
import RowColumnAction from '../../common/row-column-action'
import SimpleAlertDialog from '../../common/simple-alert-dialog'

type ColumnType = ColumnDef<typeof features, Models.Chain, unknown>

export function ChainColumn({ loading }: BaseColumnProps) {
  const columns = useMemo<ColumnType[]>(() => {
    return [
      {
        accessorKey: 'name',
        header: 'Name',
        cell: (info) => {
          const value = info.getValue() as string
          return loading ? <Skeleton className="h-5 w-full" /> : <span>{value}</span>
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
      <RowColumnAction onDelete={() => setOpenDelete(true)} />

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
