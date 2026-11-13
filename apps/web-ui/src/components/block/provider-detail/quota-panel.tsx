import { IconGauge, IconRefresh } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'

import type { Models } from '@/lib/api/models'
import type { ClineCredits, QuotaWindow, ZcodePlanQuotaRow } from '@/lib/api/models/account'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardHeading,
  CardTitle,
  CardToolbar,
} from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { axiosErrorMessage } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'
import { formatDate, formatDuration, formatTimeAgo } from '@/lib/date'
import { formatCompact } from '@/lib/format'

/** Display names for the windows Anthropic reports; unknown keys show raw. */
const WINDOW_LABELS: Record<string, { title: string; hint: string }> = {
  five_hour: { title: 'Session', hint: 'Rolling 5-hour window' },
  seven_day: { title: 'Weekly · all models', hint: '7-day window' },
  seven_day_sonnet: { title: 'Weekly · Sonnet', hint: '7-day window' },
  seven_day_opus: { title: 'Weekly · Opus', hint: '7-day window' },
}

/** Anthropic recomputes usage continuously; one minute keeps the bars and
 * reset countdowns fresh without hammering the endpoint. */
const REFRESH_MS = 60_000

/**
 * QuotaPanel shows what each account's upstream reports about its allowance:
 * Claude's rolling session and weekly windows, the ZCode plan grants
 * (billing/balance merged per entitlement), or the Cline credit balance.
 */
export default function QuotaPanel({ accounts }: { accounts: Models.Account[] }) {
  return (
    <div className="space-y-4">
      {accounts.map((account) => (
        <AccountQuotaCard key={account.id} account={account} />
      ))}
    </div>
  )
}

function AccountQuotaCard({ account }: { account: Models.Account }) {
  const query = useQuery({ ...queries.accounts.quota(account.id), refetchInterval: REFRESH_MS })
  const quota = query.data?.data
  const isZcode = account.provider === 'zcode'
  const isCline = account.provider === 'cline' || account.provider === 'clinepayg'

  const limitsLabel = isZcode
    ? 'ZCode Plan grants'
    : isCline
      ? 'Cline credit balance'
      : 'Claude subscription limits'

  const renderLimits = () => {
    if (query.isLoading) {
      return (
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
      )
    }

    if (query.isError) {
      return (
        <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive">
          {axiosErrorMessage(query.error)}
        </p>
      )
    }

    if (isZcode) {
      return (
        <ZcodePlanRows rows={quota?.rows ?? []} source={quota?.source} errors={quota?.errors} />
      )
    }

    if (quota?.credits) {
      return <ClineCreditsTile credits={quota.credits} />
    }

    if (!quota?.windows.length) {
      return (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <IconGauge className="size-4" />
          {quota?.quota_note || 'No quota windows reported for this account.'}
        </p>
      )
    }

    return (
      <div className="grid gap-4 md:grid-cols-2">
        {quota.windows.map((quotaWindow) => (
          <QuotaWindowTile
            key={quotaWindow.key}
            quotaWindow={quotaWindow}
            asOf={query.dataUpdatedAt}
          />
        ))}
      </div>
    )
  }

  return (
    <Card className="bg-background">
      <CardHeader className="py-4">
        <CardHeading>
          <CardTitle className="flex items-center gap-2">
            {account.label}
            {account.needs_reconnect ? (
              <Badge variant="destructive" appearance="light" size="sm">
                Reconnect required
              </Badge>
            ) : null}
          </CardTitle>
          <CardDescription>
            {quota?.fetched_at
              ? `${limitsLabel} · updated ${formatTimeAgo(quota.fetched_at)}`
              : limitsLabel}
          </CardDescription>
        </CardHeading>
        <CardToolbar>
          <Button
            size="sm"
            variant="outline"
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
          >
            <IconRefresh className={query.isFetching ? 'animate-spin' : undefined} /> Refresh
          </Button>
        </CardToolbar>
      </CardHeader>
      <CardContent className="p-5">{renderLimits()}</CardContent>
    </Card>
  )
}

/** A ZCode plan grant rendered as one tile: model, plan, and the daily
 * window's usage against the grant. */
function ZcodePlanRowTile({ row }: { row: ZcodePlanQuotaRow }) {
  const model =
    row.model ||
    (Array.isArray(row.models) && typeof row.models[0] === 'string' ? row.models[0] : '') ||
    'Unknown model'
  const plan = row.plan_name || row.plan || row.plan_id
  const total = typeof row.total_units === 'number' ? row.total_units : null
  const used = typeof row.used_units === 'number' ? row.used_units : null
  const remaining = typeof row.remaining_units === 'number' ? row.remaining_units : null
  const unit = typeof row.unit_type === 'string' ? row.unit_type : 'units'
  const percent = total && total > 0 && used !== null ? Math.min(100, (used / total) * 100) : null
  const tone = usageTone(percent ?? 0)
  const periodEnd =
    typeof row.period_end === 'number' ? new Date(row.period_end * 1000).toISOString() : null

  return (
    <div className="space-y-3 rounded-xl border border-border p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{model}</p>
          <p className="truncate text-xs text-muted-foreground">
            {plan}
            {row.period ? ` · ${String(row.period)} window` : ''}
          </p>
        </div>
        {row.plan_status ? (
          <Badge appearance="light" size="sm" variant="secondary">
            {String(row.plan_status)}
          </Badge>
        ) : null}
      </div>
      {percent !== null ? (
        <Progress value={percent} className="h-2" indicatorClassName={tone.bar} />
      ) : null}
      <p className="text-xs tabular-nums text-muted-foreground">
        {used !== null && total !== null
          ? `${formatCompact(used)} / ${formatCompact(total)} ${unit} used${
              remaining !== null ? ` · ${formatCompact(remaining)} left` : ''
            }`
          : total !== null
            ? `${formatCompact(total)} ${unit} granted`
            : 'No usage reported'}
        {periodEnd ? ` · resets ${formatDate(periodEnd, 'EEE dd MMM, HH:mm')}` : ''}
      </p>
    </div>
  )
}

/** The ZCode billing readout: one tile per entitled model, plus a note when
 * only plan definitions were reachable (no live usage). */
function ZcodePlanRows({
  rows,
  source,
  errors,
}: {
  rows: ZcodePlanQuotaRow[]
  source?: 'balance' | 'current'
  errors?: string[]
}) {
  if (!rows.length) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <IconGauge className="size-4" />
        {errors?.length ? errors.join(' · ') : 'No plan grants reported for this account.'}
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {source === 'current' ? (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-xs text-amber-600 dark:text-amber-400">
          Live usage is unavailable right now — showing plan definitions only.
        </p>
      ) : null}
      {errors?.length ? (
        <p className="text-xs text-muted-foreground">{errors.join(' · ')}</p>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2">
        {rows.map((row) => (
          <ZcodePlanRowTile key={row.entitlement_id || row.model} row={row} />
        ))}
      </div>
    </div>
  )
}

const CREDITS_FORMAT = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
})

/** The Cline credit balance; a negative balance means usage has overdrawn it. */
function ClineCreditsTile({ credits }: { credits: ClineCredits }) {
  const overdrawn = credits.balance < 0
  return (
    <div className="max-w-md space-y-1 rounded-xl border border-border p-4">
      <p className="text-sm font-semibold">Credit balance</p>
      <p
        className={`text-2xl font-semibold tabular-nums ${overdrawn ? 'text-red-500' : 'text-foreground'}`}
      >
        {CREDITS_FORMAT.format(credits.balance)}
      </p>
      <p className="text-xs text-muted-foreground">
        {overdrawn
          ? 'Negative: usage has gone past the credits added.'
          : 'Reported by Cline for the account behind this key.'}
      </p>
    </div>
  )
}

function usageTone(used: number) {
  if (used >= 90) return { bar: 'bg-red-500', text: 'text-red-500' }
  if (used >= 70) return { bar: 'bg-amber-500', text: 'text-amber-500' }
  return { bar: 'bg-emerald-500', text: 'text-emerald-500' }
}

/** asOf is when the snapshot was fetched; the countdown is measured from it so
 * render stays pure, and the minute refetch keeps it current. */
function QuotaWindowTile({ quotaWindow, asOf }: { quotaWindow: QuotaWindow; asOf: number }) {
  const label = WINDOW_LABELS[quotaWindow.key] ?? { title: quotaWindow.key, hint: '' }
  const used = Math.min(100, Math.max(0, quotaWindow.utilization))
  const tone = usageTone(used)
  const resetsAt = quotaWindow.resets_at
  const secondsLeft = resetsAt
    ? Math.max(0, Math.round((new Date(resetsAt).getTime() - asOf) / 1000))
    : null

  return (
    <div className="space-y-3 rounded-xl border border-border p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">{label.title}</p>
          {label.hint ? <p className="text-xs text-muted-foreground">{label.hint}</p> : null}
        </div>
        <span className={`text-lg font-semibold tabular-nums ${tone.text}`}>
          {Math.round(used)}%
        </span>
      </div>
      <Progress value={used} className="h-2" indicatorClassName={tone.bar} />
      <p className="text-xs tabular-nums text-muted-foreground">
        {resetsAt && secondsLeft !== null
          ? `Resets in ${formatDuration(secondsLeft)} · ${formatDate(resetsAt, 'EEE dd MMM, HH:mm')}`
          : 'No reset scheduled'}
      </p>
    </div>
  )
}
