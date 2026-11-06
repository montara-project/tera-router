import type { ColumnDef } from '@tanstack/react-table'

import { IconCheck, IconChevronRight, IconCopy, IconStack2 } from '@tabler/icons-react'
import { useMutation } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import { HealthBadge } from '@/components/block/dashboard/overview-provider-health'
import { ProviderAvatar } from '@/components/block/providers/provider-avatar'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
import { toastAxiosError } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'
import { CHAIN_STRATEGY_OPTIONS, chainStrategyLabel } from '@/lib/constants/chain'
import { formatCount } from '@/lib/format'

import type { ChainRow } from './filter'

import { features } from '../../common/react-table'
import RowColumnAction from '../../common/row-column-action'
import SimpleAlertDialog from '../../common/simple-alert-dialog'

type ColumnType = ColumnDef<typeof features, ChainRow, unknown>

const RIGHT = { headerClassName: 'text-right', cellClassName: 'text-right tabular-nums' }

interface ChainsColumnProps {
  /** provider slug → api_kind, so custom providers get the right logo */
  apiKinds: Map<string, string>
}

export function ChainsColumn({ apiKinds }: ChainsColumnProps) {
  return useMemo<ColumnType[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Chain',
        meta: { headerClassName: 'w-[28%]', cellClassName: 'max-w-0' },
        cell: ({ row }) => <ChainName row={row.original} />,
      },
      {
        accessorKey: 'strategy',
        header: 'Strategy',
        meta: { cellClassName: 'whitespace-nowrap' },
        cell: ({ row }) => {
          const StrategyIcon =
            CHAIN_STRATEGY_OPTIONS.find((o) => o.value === row.original.strategy)?.icon ??
            IconStack2
          const steps = row.original.steps.length
          return (
            <>
              <span className="inline-flex items-center gap-1 rounded-sm bg-primary/10 px-1.5 py-0.5 text-[11.5px] font-medium text-primary ring-1 ring-primary/30 ring-inset">
                <StrategyIcon className="size-3" aria-hidden />
                {chainStrategyLabel(row.original.strategy)}
              </span>
              <span className="ms-1.5 text-xs text-muted-foreground">
                {steps} {steps === 1 ? 'step' : 'steps'}
              </span>
            </>
          )
        },
      },
      {
        id: 'route',
        header: 'Route',
        cell: ({ row }) => <ChainRoute row={row.original} apiKinds={apiKinds} />,
      },
      {
        id: 'health',
        header: 'Health (24h)',
        cell: ({ row }) =>
          row.original.health ? (
            <HealthBadge status={row.original.health.status} />
          ) : (
            <span className="text-xs text-muted-foreground">Unknown</span>
          ),
      },
      {
        id: 'requests',
        header: 'Requests',
        meta: RIGHT,
        cell: ({ row }) => (row.original.health ? formatCount(row.original.health.requests) : '—'),
      },
      {
        id: 'fallback',
        header: 'Fallback rate',
        meta: RIGHT,
        cell: ({ row }) =>
          row.original.health ? `${row.original.health.fallbackRate.toFixed(1)}%` : '—',
      },
      {
        id: 'actions',
        header: () => <span className="sr-only">Actions</span>,
        meta: { headerClassName: 'w-12', cellClassName: 'text-right' },
        cell: ({ row }) => <RowActions row={row.original} />,
      },
    ],
    [apiKinds]
  )
}

function ChainName({ row }: { row: ChainRow }) {
  const target = `chain:${row.name}`
  const { copy, copied } = useCopyToClipboard()

  return (
    <>
      <div className="flex min-w-0 items-center gap-2">
        <Link
          to="/chains/$chainId"
          params={{ chainId: row.id }}
          className="truncate rounded-sm font-medium hover:underline"
          title={row.name}
        >
          {row.name}
        </Link>
        {!row.enabled && (
          <span className="shrink-0 rounded-sm bg-muted px-1.5 text-[11px] text-muted-foreground">
            Off
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={() => copy(target)}
        aria-label={copied ? `${target} copied` : `Copy ${target}`}
        className="inline-flex max-w-full items-center gap-1 rounded-sm text-xs text-muted-foreground hover:text-foreground"
      >
        <span className="truncate font-mono">{target}</span>
        {copied ? (
          <IconCheck className="size-3 shrink-0" aria-hidden />
        ) : (
          <IconCopy className="size-3 shrink-0" aria-hidden />
        )}
      </button>
    </>
  )
}

function ChainRoute({ row, apiKinds }: { row: ChainRow; apiKinds: Map<string, string> }) {
  return (
    <ol className="flex flex-wrap items-center gap-1" aria-label={`Route for ${row.name}`}>
      {row.steps.map((step, i) => (
        <li
          key={step.id}
          className="flex items-center gap-1"
          title={`${step.provider}/${step.model}${step.active ? '' : ' (skipped)'}`}
        >
          {i > 0 && <IconChevronRight className="size-3 text-muted-foreground" aria-hidden />}
          <ProviderAvatar
            slug={step.provider}
            apiKind={apiKinds.get(step.provider)}
            size="xs"
            className={`size-5 rounded-[4px] ${step.active ? '' : 'opacity-40'}`}
          />
          <span className="sr-only">
            {step.provider}/{step.model}
            {step.active ? '' : ', skipped'}
          </span>
        </li>
      ))}
      {row.steps.length === 0 && <li className="text-xs text-muted-foreground">No steps</li>}
    </ol>
  )
}

function RowActions({ row }: { row: ChainRow }) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const navigate = useNavigate()
  const { copy } = useCopyToClipboard({ onCopy: () => toast.success(`Copied chain:${row.name}`) })
  const deleteMutation = useMutation(queries.chains.delete())

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(row.id)
      toast.success(`Chain ${row.name} deleted`)
      setConfirmOpen(false)
    } catch (error) {
      toastAxiosError(error)
    }
  }

  return (
    <>
      <RowColumnAction
        noun="chain"
        name={row.name}
        onEdit={() => void navigate({ to: '/chains/$chainId', params: { chainId: row.id } })}
        onDelete={() => setConfirmOpen(true)}
        dropdown={
          <DropdownMenuItem onClick={() => copy(`chain:${row.name}`)}>
            <IconCopy />
            Copy model target
          </DropdownMenuItem>
        }
      />

      <SimpleAlertDialog
        title={`Delete chain ${row.name}?`}
        description={`Clients calling chain:${row.name} stop routing through it. This cannot be undone.`}
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onConfirm={handleDelete}
        confirmText="Delete"
        variant="destructive"
      />
    </>
  )
}
