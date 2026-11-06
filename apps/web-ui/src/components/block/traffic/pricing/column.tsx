import type { ColumnDef } from '@tanstack/react-table'

import { useMutation } from '@tanstack/react-query'
import React, { useMemo, useState } from 'react'
import { toast } from 'sonner'

import type { Models } from '@/lib/api/models'
import type { BaseColumnProps } from '@/types/column'

import { Badge, BadgeDot } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { toastAxiosError } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'
import { formatRate } from '@/lib/currency'

import { features } from '../../common/react-table'
import RowColumnAction from '../../common/row-column-action'
import SimpleAlertDialog from '../../common/simple-alert-dialog'
import ModelGroup from './model-group'

type ColumnType = ColumnDef<typeof features, Models.PricingOverride, unknown>

type PricingColumnProps = BaseColumnProps & {
  onEdit?: (override: Models.PricingOverride) => void
}

function describeModel(model: string): string {
  return model === '' ? 'all models' : model
}

export function PricingColumn({ loading, onEdit }: PricingColumnProps) {
  const columns = useMemo<ColumnType[]>(() => {
    return [
      {
        accessorKey: 'provider',
        header: 'Provider',
        cell: ({ row }) => {
          return loading ? (
            <Skeleton className="h-5 w-full" />
          ) : (
            <ModelGroup
              slug={row.original.provider}
              title={row.original.provider}
              description={describeModel(row.original.model)}
            />
          )
        },
      },
      {
        accessorKey: 'model',
        header: 'Scope',
        cell: ({ row }) => {
          if (loading) {
            return <Skeleton className="h-5 w-full" />
          }

          const providerWide = row.original.model === ''
          return (
            <Badge variant={providerWide ? 'info' : 'secondary'} appearance="light" size="sm">
              <BadgeDot />
              {providerWide ? 'Provider-wide' : 'Per model'}
            </Badge>
          )
        },
        size: 80,
      },
      {
        accessorKey: 'input_micros',
        header: 'Input $/M',
        cell: ({ row }) => {
          if (loading) {
            return <Skeleton className="h-5 w-full" />
          }

          return (
            <span
              className={row.original.input_micros === 0 ? 'text-muted-foreground' : 'tabular-nums'}
            >
              {formatRate(row.original.input_micros)}
            </span>
          )
        },
        size: 80,
      },
      {
        accessorKey: 'output_micros',
        header: 'Output $/M',
        cell: ({ row }) => {
          if (loading) {
            return <Skeleton className="h-5 w-full" />
          }

          return (
            <span
              className={
                row.original.output_micros === 0 ? 'text-muted-foreground' : 'tabular-nums'
              }
            >
              {formatRate(row.original.output_micros)}
            </span>
          )
        },
        size: 80,
      },
      {
        // Same as the /chains table: a narrow last column, the menu flush right.
        id: 'actions',
        header: () => <span className="sr-only">Actions</span>,
        meta: { headerClassName: 'w-12', cellClassName: 'text-right' },
        cell: ({ row }) => {
          return loading ? (
            <Skeleton className="ms-auto h-5 w-8" />
          ) : (
            <ActionCell record={row.original} onEdit={onEdit} />
          )
        },
      },
    ]
  }, [loading, onEdit])

  return columns
}

interface ActionCellProps {
  record: Models.PricingOverride
  onEdit?: (override: Models.PricingOverride) => void
}

function ActionCell({ record, onEdit }: ActionCellProps) {
  const [openDelete, setOpenDelete] = useState(false)

  const deleteMutation = useMutation(queries.overrides.pricingDelete())

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync({ provider: record.provider, model: record.model })
      toast.success('Pricing override deleted')
      setOpenDelete(false)
    } catch (error) {
      toastAxiosError(error as Error)
    }
  }

  return (
    <React.Fragment>
      <RowColumnAction
        noun="override"
        name={`${record.provider} / ${describeModel(record.model)}`}
        onEdit={onEdit ? () => onEdit(record) : undefined}
        onDelete={() => setOpenDelete(true)}
      />

      <SimpleAlertDialog
        title="Delete this pricing override?"
        description={`Delete the override for ${record.provider} / ${describeModel(record.model)}? Built-in catalog pricing takes over.`}
        open={openDelete}
        onOpenChange={setOpenDelete}
        onConfirm={handleDelete}
        confirmText="Delete"
        variant="destructive"
      />
    </React.Fragment>
  )
}
