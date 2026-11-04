import { IconPigMoney } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'

import type { BudgetStatus } from '@/lib/api/models/budget'
import type { UsageTelemetryOverview } from '@/lib/api/models/usage'

import { SCOPE_LABELS } from '@/components/block/budgets/form'
import DashboardPanel, { PanelLink } from '@/components/block/dashboard/dashboard-panel'
import { Skeleton } from '@/components/ui/skeleton'
import { queries } from '@/lib/api/queries'
import { formatMicrosUsd } from '@/lib/currency'
import { formatCompact, formatCount } from '@/lib/format'
import { cn } from '@/lib/utils'

const BUDGET_LIMIT = 3

/** Days until the budget's period rolls over (server: daily, Monday-start weekly, monthly). */
function resetsInDays(period: BudgetStatus['period'], now = new Date()): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  if (period === 'weekly') next.setDate(next.getDate() + ((8 - next.getDay()) % 7))
  if (period === 'monthly') next.setFullYear(now.getFullYear(), now.getMonth() + 1, 1)
  return Math.max(1, Math.ceil((next.getTime() - now.getTime()) / 86_400_000))
}

export default function OverviewSavingsBudgets({
  telemetry,
}: {
  telemetry: UsageTelemetryOverview
}) {
  const { optimization, spend, tokenComposition } = telemetry
  const optimizers = [
    {
      label: 'Semantic cache',
      detail: `${formatCount(tokenComposition.requestCacheHits)} cache hits`,
      value: tokenComposition.requestCacheHits > 0 ? 'not priced' : '$0.00',
      tone: 'bg-primary',
    },
    {
      label: 'Input compression',
      detail: `${formatCompact(optimization.tokensSaved)} tokens removed`,
      value: optimization.tokensSaved > 0 ? 'not priced' : '$0.00',
      tone: 'bg-primary/60',
    },
    {
      label: 'Output shaping',
      detail: 'not priced',
      value: `${formatCount(optimization.shapedRequests)} req`,
      tone: 'bg-muted-foreground/40',
    },
  ]

  return (
    <DashboardPanel title="Savings and budgets" icon={IconPigMoney}>
      <div className="flex flex-col gap-2 border-b border-border p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-muted-foreground text-[13px]">Saved by optimizers</p>
          <PanelLink label="Configure" to="/settings" />
        </div>
        <p className="text-xl font-semibold tabular-nums">
          {formatMicrosUsd(spend.valueSavedMicros)}
        </p>
        <ul className="flex flex-col gap-2 pt-1">
          {optimizers.map((o) => (
            <li key={o.label} className="flex items-center gap-2.5 text-[13px]">
              <span className={cn('size-2 shrink-0 rounded-[2px]', o.tone)} aria-hidden />
              <span className="min-w-0 flex-1 truncate">
                <span className="font-medium">{o.label}</span>
                <span className="text-muted-foreground"> · {o.detail}</span>
              </span>
              <span className="tabular-nums">{o.value}</span>
            </li>
          ))}
        </ul>
      </div>
      <Budgets />
    </DashboardPanel>
  )
}

function Budgets() {
  const { data, isLoading } = useQuery(queries.budgets.status())
  const keys = useQuery(queries.keys.list({ offset: 0, limit: 100 })).data?.data ?? []
  const accounts = useQuery(queries.accounts.list({ offset: 0, limit: 100 })).data?.data ?? []
  const names = new Map<string, string>([
    ...keys.map((k) => [k.id, k.name] as [string, string]),
    ...accounts.map((a) => [a.id, a.label || a.provider] as [string, string]),
  ])
  const budgets = (data?.data ?? []).slice(0, BUDGET_LIMIT)

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-muted-foreground text-[13px]">Budgets</p>
        <PanelLink label="Manage" to="/budgets" />
      </div>
      {isLoading && <Skeleton className="h-12 w-full rounded-md" />}
      {!isLoading && budgets.length === 0 && (
        <p className="text-muted-foreground text-sm">No budgets set.</p>
      )}
      {budgets.map((b) => {
        const byTokens = b.limit_tokens > 0
        const pct = byTokens ? b.token_pct : b.spend_pct
        const name =
          b.scope_kind === 'tenant' ? SCOPE_LABELS.tenant : (names.get(b.scope_id) ?? b.scope_id)
        return (
          <div key={b.id} className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-3 text-[13px]">
              <span className="truncate font-mono font-medium" title={name}>
                {name}
              </span>
              <span className="tabular-nums">{Math.round(pct)}%</span>
            </div>
            <div
              className="bg-muted h-1.5 overflow-hidden rounded-full"
              role="progressbar"
              aria-label={`${name} budget used`}
              aria-valuenow={Math.round(pct)}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className={cn(
                  'h-full rounded-full',
                  pct >= b.alert_pct ? 'bg-amber-500' : 'bg-primary'
                )}
                style={{ width: `${Math.min(pct, 100)}%` }}
              />
            </div>
            <div className="text-muted-foreground flex justify-between gap-3 text-xs tabular-nums">
              <span>
                {byTokens
                  ? `${formatCompact(b.spent_tokens)} of ${formatCompact(b.limit_tokens)} tokens`
                  : `${formatMicrosUsd(b.spent_micros)} of ${formatMicrosUsd(b.limit_micros)}`}{' '}
                · {b.period}
              </span>
              <span>Resets in {resetsInDays(b.period)}d</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
