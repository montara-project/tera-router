import {
  IconCheck,
  IconChevronRight,
  IconCopy,
  IconDots,
  IconEdit,
  IconStack2,
  IconTrash,
} from '@tabler/icons-react'
import { useMutation } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'

import EmptyState from '@/components/block/common/empty-state'
import SimpleAlertDialog from '@/components/block/common/simple-alert-dialog'
import DashboardPanel from '@/components/block/dashboard/dashboard-panel'
import { HealthBadge } from '@/components/block/dashboard/overview-provider-health'
import { ProviderAvatar } from '@/components/block/providers/provider-avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
import { toastAxiosError } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'
import { CHAIN_STRATEGY_OPTIONS, chainStrategyLabel } from '@/lib/constants/chain'
import { formatCount } from '@/lib/format'

import type { ChainRow } from './filter'

interface ChainsTableProps {
  rows: ChainRow[]
  /** chain count before filtering, to tell "none yet" from "none match" */
  total: number
  loading: boolean
  /** provider slug → api_kind, so custom providers get the right logo */
  apiKinds: Map<string, string>
}

export default function ChainsTable({ rows, total, loading, apiKinds }: ChainsTableProps) {
  return (
    <DashboardPanel
      icon={IconStack2}
      title={
        <>
          All chains
          <span className="font-normal text-muted-foreground tabular-nums">{total}</span>
        </>
      }
    >
      {!loading && rows.length === 0 ? (
        <EmptyState
          icon={IconStack2}
          title={total === 0 ? 'No chains yet' : 'No chains match'}
          description={
            total === 0
              ? 'Create a chain to route one model name through fallback models.'
              : 'Try a different search, strategy or health filter.'
          }
          className="py-10"
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[56rem] text-[13px]">
            <thead className="border-b border-border text-xs text-muted-foreground dark:bg-muted/40">
              <tr>
                <th className="w-[28%] px-4 py-2 text-left font-medium">Chain</th>
                <th className="px-4 py-2 text-left font-medium">Strategy</th>
                <th className="px-4 py-2 text-left font-medium">Route</th>
                <th className="px-4 py-2 text-left font-medium">Health (24h)</th>
                <th className="px-4 py-2 text-right font-medium">Requests</th>
                <th className="px-4 py-2 text-right font-medium">Fallback rate</th>
                <th className="w-12 px-2 py-2">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 3 }, (_, i) => (
                    <tr key={i} className="border-b border-border last:border-0">
                      <td colSpan={7} className="px-4 py-3">
                        <Skeleton className="h-9 w-full" />
                      </td>
                    </tr>
                  ))
                : rows.map((row) => <ChainTableRow key={row.id} row={row} apiKinds={apiKinds} />)}
            </tbody>
          </table>
        </div>
      )}
    </DashboardPanel>
  )
}

function ChainTableRow({ row, apiKinds }: { row: ChainRow; apiKinds: Map<string, string> }) {
  const target = `chain:${row.name}`
  const { copy, copied } = useCopyToClipboard()
  const StrategyIcon =
    CHAIN_STRATEGY_OPTIONS.find((o) => o.value === row.strategy)?.icon ?? IconStack2
  const steps = row.steps.length

  return (
    <tr className="border-b border-border last:border-0">
      <td className="max-w-0 px-4 py-2.5">
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
      </td>
      <td className="px-4 py-2.5 whitespace-nowrap">
        <span className="inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[11.5px] font-medium text-primary ring-1 ring-primary/30 ring-inset bg-primary/10">
          <StrategyIcon className="size-3" aria-hidden />
          {chainStrategyLabel(row.strategy)}
        </span>
        <span className="ms-1.5 text-xs text-muted-foreground">
          {steps} {steps === 1 ? 'step' : 'steps'}
        </span>
      </td>
      <td className="px-4 py-2.5">
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
          {steps === 0 && <li className="text-xs text-muted-foreground">No steps</li>}
        </ol>
      </td>
      <td className="px-4 py-2.5">
        {row.health ? (
          <HealthBadge status={row.health.status} />
        ) : (
          <span className="text-xs text-muted-foreground">Unknown</span>
        )}
      </td>
      <td className="px-4 py-2.5 text-right tabular-nums">
        {row.health ? formatCount(row.health.requests) : '—'}
      </td>
      <td className="px-4 py-2.5 text-right tabular-nums">
        {row.health ? `${row.health.fallbackRate.toFixed(1)}%` : '—'}
      </td>
      <td className="px-2 py-2.5 text-right">
        <RowActions row={row} />
      </td>
    </tr>
  )
}

function RowActions({ row }: { row: ChainRow }) {
  const [confirmOpen, setConfirmOpen] = useState(false)
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
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label={`Actions for ${row.name}`}
          >
            <IconDots className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-36">
          <DropdownMenuItem asChild>
            <Link to="/chains/$chainId" params={{ chainId: row.id }}>
              <IconEdit />
              Edit
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onClick={() => setConfirmOpen(true)}>
            <IconTrash />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

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
