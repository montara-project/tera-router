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

import { features } from '../../common/react-table'
import RowColumnAction from '../../common/row-column-action'
import SimpleAlertDialog from '../../common/simple-alert-dialog'
import ModelGroup from './model-group'

type ColumnType = ColumnDef<typeof features, Models.PricingOverride, unknown>

type PricingColumnProps = BaseColumnProps & {
  onEdit?: (override: Models.PricingOverride) => void
}

/** Render a USD-per-million rate; 0 shows "free" so a real zero is visible. */
function formatRate(micros: number): string {
  if (micros === 0) return 'free'
  return `$${(micros / 1_000_000).toFixed(4).replace(/\.?0+$/, '')}`
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
        size: 140,
      },
      {
        accessorKey: 'input_micros',
        header: 'Input $/M',
        cell: ({ row }) => {
          if (loading) {
            return <Skeleton className="h-5 w-full" />
          }

          return (
            <span className="text-sm tabular-nums text-foreground">
              {formatRate(row.original.input_micros)}
            </span>
          )
        },
        size: 110,
      },
      {
        accessorKey: 'output_micros',
        header: 'Output $/M',
        cell: ({ row }) => {
          if (loading) {
            return <Skeleton className="h-5 w-full" />
          }

          return (
            <span className="text-sm tabular-nums text-foreground">
              {formatRate(row.original.output_micros)}
            </span>
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
