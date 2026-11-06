import {
  IconAlertTriangle,
  IconBan,
  IconChartBar,
  IconCoins,
  IconDots,
  IconEdit,
  IconGaugeFilled,
  IconTrash,
} from '@tabler/icons-react'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'

import type { BudgetScopeKind, BudgetStatus } from '@/lib/api/models/budget'
import type { Option } from '@/types/select'

import BudgetFormDialog, { SCOPE_LABELS } from '@/components/block/budgets/form'
import EmptyState from '@/components/block/common/empty-state'
import SimpleAlertDialog from '@/components/block/common/simple-alert-dialog'
import DashboardPanel from '@/components/block/dashboard/dashboard-panel'
import { Stat } from '@/components/block/provider-detail/provider-stat-strip'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
  const rows = [...budgets].sort((a, b) => usedPct(b) - usedPct(a))

  return (
    <DashboardPanel icon={IconChartBar} title="Budget usage" description="Closest to limit first">
      {rows.length === 0 ? (
        <EmptyState
          icon={IconCoins}
          title="No budgets yet"
          description="Create a budget to alert on or block traffic once a period's spend or tokens run out."
          action={<Button onClick={onCreate}>New budget</Button>}
        />
      ) : (
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[60rem] text-[13px]">
            <thead className="border-b border-border text-xs text-muted-foreground dark:bg-muted/40">
              <tr>
                <th className="w-[13%] px-4 py-2 text-left font-medium">Scope</th>
                <th className="w-[34%] px-4 py-2 text-left font-medium">Usage</th>
                <th className="px-4 py-2 text-right font-medium">Used</th>
                <th className="px-4 py-2 text-left font-medium">Period</th>
                <th className="px-4 py-2 text-left font-medium">Enforcement</th>
                <th className="w-12 px-2 py-2">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((budget) => (
                <BudgetRow
                  key={budget.id}
                  budget={budget}
                  name={
                    budget.scope_kind === 'tenant'
                      ? SCOPE_LABELS.tenant
                      : (scopeNames.get(budget.scope_id) ?? budget.scope_id)
                  }
                  scopeOptions={scopeOptions}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </DashboardPanel>
  )
}

function BudgetRow({
  budget,
  name,
  scopeOptions,
}: {
  budget: BudgetStatus
  name: string
  scopeOptions: ScopeOptions
}) {
  const [openEdit, setOpenEdit] = useState(false)
  const [openDelete, setOpenDelete] = useState(false)
  const deleteMutation = useMutation(queries.budgets.delete())

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(budget.id)
      toast.success('Budget deleted')
      setOpenDelete(false)
    } catch (error) {
      toastAxiosError(error)
    }
  }

  const pct = usedPct(budget)
  const hasLimit = budget.limit_micros > 0 || budget.limit_tokens > 0
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
    <tr className="border-b border-border last:border-0">
      <td className="max-w-0 px-4 py-2.5">
        <span className="block truncate font-medium" title={name}>
          {name}
        </span>
        <span className="block text-xs text-muted-foreground">{KIND_SHORT[budget.scope_kind]}</span>
      </td>
      <td className="px-4 py-2.5">
        {hasLimit ? (
          <>
            <div
              className="h-1.5 overflow-hidden rounded-full bg-muted"
              role="img"
              aria-label={`${name}: ${Math.round(pct)}% of the budget used`}
            >
              <div className={cn('h-full', bar)} style={{ width: `${Math.min(pct, 100)}%` }} />
            </div>
            <span className="mt-1 block text-xs text-muted-foreground tabular-nums">
              {usage.join(' · ')}
            </span>
          </>
        ) : (
          <span className="text-xs text-muted-foreground">No limit set, tracking only</span>
        )}
      </td>
      <td className="px-4 py-2.5 text-right">
        <span
          className={cn(
            'block font-medium tabular-nums',
            pct >= 100 && 'text-red-600 dark:text-red-400'
          )}
        >
          {hasLimit ? `${Math.round(pct)}%` : '—'}
        </span>
        <span className="block text-xs text-muted-foreground">Alert at {budget.alert_pct}%</span>
      </td>
      <td className="px-4 py-2.5">
        <span className="block text-muted-foreground">{PERIOD_LABELS[budget.period]}</span>
        <span
          className="block text-xs text-muted-foreground"
          title={formatDateTime(budget.resets_at)}
        >
          {formatResetsIn(budget.resets_at)}
        </span>
      </td>
      <td className="px-4 py-2.5">
        <span className="inline-flex h-5 items-center rounded-sm border border-border bg-card px-1.5 text-[11.5px] font-medium">
          {budget.hard_cutoff ? 'Hard cutoff' : 'Alert only'}
        </span>
      </td>
      <td className="px-2 py-2.5 text-right">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              aria-label={`Actions for the ${name} budget`}
            >
              <IconDots className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-36">
            <DropdownMenuItem onClick={() => setOpenEdit(true)}>
              <IconEdit />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onClick={() => setOpenDelete(true)}>
              <IconTrash />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <BudgetFormDialog
          open={openEdit}
          onOpenChange={setOpenEdit}
          budget={budget}
          scopeOptions={scopeOptions}
        />
        <SimpleAlertDialog
          confirmText="Delete"
          description={`The budget for "${name}" will be permanently deleted and stop capping traffic.`}
          onConfirm={handleDelete}
          onOpenChange={setOpenDelete}
          open={openDelete}
          title="Delete this budget?"
          variant="destructive"
        />
      </td>
    </tr>
  )
}
