import type { ColumnDef } from '@tanstack/react-table'

import {
  IconAlertTriangle,
  IconBan,
  IconChartBar,
  IconCoins,
  IconGaugeFilled,
} from '@tabler/icons-react'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'

import type { BudgetScopeKind, BudgetStatus } from '@/lib/api/models/budget'
import type { Option } from '@/types/select'

import BudgetFormDialog, { SCOPE_LABELS } from '@/components/block/budgets/form'
import EmptyState from '@/components/block/common/empty-state'
import ReactTable, { features } from '@/components/block/common/react-table'
import RowColumnAction from '@/components/block/common/row-column-action'
import SectionCardPanel from '@/components/block/common/section-card-panel'
import SimpleAlertDialog from '@/components/block/common/simple-alert-dialog'
import { Stat } from '@/components/block/provider-detail/provider-stat-strip'
import { Button } from '@/components/ui/button'
import { usePaginationQuery } from '@/hooks/use-pagination-query'
import { toastAxiosError } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'
import { formatMicrosUsd } from '@/lib/currency'
import { formatDateTime, formatResetsIn } from '@/lib/date'
import { formatCompact } from '@/lib/format'
import { cn } from '@/lib/utils'

type ScopeOptions = Record<'api_key' | 'account', Option<unknown>[]>

const KIND_SHORT: Record<BudgetScopeKind, string> = {
  tenant: 'Instance',
  api_key: 'Key',
  account: 'Account',
}

const PERIOD_LABELS: Record<BudgetStatus['period'], string> = {
  daily: 'Per day',
  weekly: 'Per week',
  monthly: 'Per month',
}

/** The pager never offers fewer than 10 rows. */
const PAGE_SIZES = [10, 25, 50, 100]

const TILE = 'bg-orange-500/10 text-orange-600 dark:text-orange-400'

/** The cap closest to running out decides how full a budget is. */
export const usedPct = (b: BudgetStatus) =>
  Math.max(b.limit_micros > 0 ? b.spend_pct : 0, b.limit_tokens > 0 ? b.token_pct : 0)

export function BudgetsStats({ budgets }: { budgets: BudgetStatus[] }) {
  const exhausted = budgets.filter((b) => usedPct(b) >= 100)
  const pastAlert = budgets.filter((b) => {
    const pct = usedPct(b)
    return pct < 100 && b.alert_pct > 0 && pct >= b.alert_pct
  }).length
  const blocking = exhausted.filter((b) => b.hard_cutoff).length

  const figure = (value: number) => (
    <span
      className={cn('text-xl font-semibold tabular-nums', value === 0 && 'text-muted-foreground')}
    >
      {value}
    </span>
  )

  return (
    <dl className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-3">
      <Stat icon={IconAlertTriangle} label="Past alert threshold" iconClassName={TILE}>
        {figure(pastAlert)}
        <span className="block text-xs text-muted-foreground">of {budgets.length}</span>
      </Stat>
      <Stat icon={IconGaugeFilled} label="Exhausted" iconClassName={TILE}>
        {figure(exhausted.length)}
      </Stat>
      <Stat icon={IconBan} label="Blocking requests" iconClassName={TILE}>
        {figure(blocking)}
      </Stat>
    </dl>
  )
}

interface BudgetsTableProps {
  budgets: BudgetStatus[]
  scopeNames: Map<string, string>
  scopeOptions: ScopeOptions
  onCreate: () => void
}

/** "Budget usage" panel: every budget, closest to its limit first. */
export default function BudgetsTable({
  budgets,
  scopeNames,
  scopeOptions,
  onCreate,
}: BudgetsTableProps) {
  // The list arrives whole, so sorting and paging run here; the pager keeps its page in ?page.
  const { offset, limit, pageIndex } = usePaginationQuery()
  const rows = [...budgets].sort((a, b) => usedPct(b) - usedPct(a))

  // The target outlives its dialog's open flag so the dialog keeps its content while closing.
  const [editing, setEditing] = useState<BudgetStatus | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [deleting, setDeleting] = useState<BudgetStatus | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const deleteMutation = useMutation(queries.budgets.delete())

  const columns = ((): ColumnDef<typeof features, BudgetStatus, unknown>[] => {
    const nameOf = (b: BudgetStatus) =>
      b.scope_kind === 'tenant' ? SCOPE_LABELS.tenant : (scopeNames.get(b.scope_id) ?? b.scope_id)

    return [
      {
        id: 'scope',
        header: 'Scope',
        meta: { headerClassName: 'w-[13%]', cellClassName: 'max-w-0' },
        cell: ({ row }) => (
          <>
            <span className="block truncate font-medium" title={nameOf(row.original)}>
              {nameOf(row.original)}
            </span>
            <span className="block text-xs text-muted-foreground">
              {KIND_SHORT[row.original.scope_kind]}
            </span>
          </>
        ),
      },
      {
        id: 'usage',
        header: 'Usage',
        meta: { headerClassName: 'w-[34%]' },
        cell: ({ row }) => {
          const budget = row.original
          const pct = usedPct(budget)
          if (budget.limit_micros <= 0 && budget.limit_tokens <= 0) {
            return (
              <span className="text-xs text-muted-foreground">No limit set, tracking only</span>
            )
          }
          const usage = [
            budget.limit_micros > 0 &&
              `${formatMicrosUsd(budget.spent_micros)} of ${formatMicrosUsd(budget.limit_micros)}`,
            budget.limit_tokens > 0 &&
              `${formatCompact(budget.spent_tokens)} of ${formatCompact(budget.limit_tokens)} tokens`,
          ].filter(Boolean)
          const bar =
            pct >= 100
              ? 'bg-red-500'
              : budget.alert_pct > 0 && pct >= budget.alert_pct
                ? 'bg-amber-500'
                : 'bg-primary'
          return (
            <>
              <div
                className="h-1.5 overflow-hidden rounded-full bg-muted"
                role="img"
                aria-label={`${nameOf(budget)}: ${Math.round(pct)}% of the budget used`}
              >
                <div className={cn('h-full', bar)} style={{ width: `${Math.min(pct, 100)}%` }} />
              </div>
              <span className="mt-1 block text-xs text-muted-foreground tabular-nums">
                {usage.join(' · ')}
              </span>
            </>
          )
        },
      },
      {
        id: 'used',
        header: 'Used',
        meta: { headerClassName: 'text-right', cellClassName: 'text-right' },
        cell: ({ row }) => {
          const budget = row.original
          const pct = usedPct(budget)
          const hasLimit = budget.limit_micros > 0 || budget.limit_tokens > 0
          return (
            <>
              <span
                className={cn(
                  'block font-medium tabular-nums',
                  pct >= 100 && 'text-red-600 dark:text-red-400'
                )}
              >
                {hasLimit ? `${Math.round(pct)}%` : '—'}
              </span>
              <span className="block text-xs text-muted-foreground">
                Alert at {budget.alert_pct}%
              </span>
            </>
          )
        },
      },
      {
        id: 'period',
        header: 'Period',
        cell: ({ row }) => (
          <>
            <span className="block text-muted-foreground">
              {PERIOD_LABELS[row.original.period]}
            </span>
            <span
              className="block text-xs text-muted-foreground"
              title={formatDateTime(row.original.resets_at)}
            >
              {formatResetsIn(row.original.resets_at)}
            </span>
          </>
        ),
      },
      {
        id: 'enforcement',
        header: 'Enforcement',
        cell: ({ row }) => (
          <span className="inline-flex h-5 items-center rounded-sm border border-border bg-card px-1.5 text-[11.5px] font-medium">
            {row.original.hard_cutoff ? 'Hard cutoff' : 'Alert only'}
          </span>
        ),
      },
      {
        id: 'actions',
        header: () => <span className="sr-only">Actions</span>,
        meta: { headerClassName: 'w-12', cellClassName: 'text-right' },
        cell: ({ row }) => (
          <RowColumnAction
            noun="budget"
            name={`the ${nameOf(row.original)} budget`}
            onEdit={() => {
              setEditing(row.original)
              setEditOpen(true)
            }}
            onDelete={() => {
              setDeleting(row.original)
              setDeleteOpen(true)
            }}
          />
        ),
      },
    ]
  })()

  const handleDelete = async () => {
    if (!deleting) return
    try {
      await deleteMutation.mutateAsync(deleting.id)
      toast.success('Budget deleted')
      setDeleteOpen(false)
    } catch (error) {
      toastAxiosError(error)
    }
  }

  const deletingName = deleting
    ? deleting.scope_kind === 'tenant'
      ? SCOPE_LABELS.tenant
      : (scopeNames.get(deleting.scope_id) ?? deleting.scope_id)
    : ''

  return (
    <SectionCardPanel icon={IconChartBar} title="Budget usage" description="Closest to limit first">
      {rows.length === 0 ? (
        <EmptyState
          icon={IconCoins}
          title="No budgets yet"
          description="Create a budget to alert on or block traffic once a period's spend or tokens run out."
          action={<Button onClick={onCreate}>New budget</Button>}
        />
      ) : (
        <ReactTable
          total={rows.length}
          data={rows.slice(offset, offset + limit)}
          pageIndex={pageIndex}
          pageSize={limit}
          pageSizes={PAGE_SIZES}
          columns={columns}
          tableClassName="min-w-[60rem]"
        />
      )}

      {editing && (
        <BudgetFormDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          budget={editing}
          scopeOptions={scopeOptions}
        />
      )}
      <SimpleAlertDialog
        confirmText="Delete"
        description={`The budget for "${deletingName}" will be permanently deleted and stop capping traffic.`}
        onConfirm={handleDelete}
        onOpenChange={setDeleteOpen}
        open={deleteOpen}
        title="Delete this budget?"
        variant="destructive"
      />
    </SectionCardPanel>
  )
}
