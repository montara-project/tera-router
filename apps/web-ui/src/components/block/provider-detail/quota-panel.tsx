import { IconGauge, IconRefresh } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'

import type { Models } from '@/lib/api/models'
import type { QuotaWindow } from '@/lib/api/models/account'

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
 * QuotaPanel shows the live Claude subscription limits of every OAuth
 * account on this provider: the rolling session window and the weekly
 * allowances, each with its utilization and reset time.
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

  return (
    <Card className="bg-background">
      <CardHeader className="h-20">
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
              ? `Claude subscription limits · updated ${formatTimeAgo(quota.fetched_at)}`
              : 'Claude subscription limits'}
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
      <CardContent className="p-5">
        {query.isLoading ? (
          <div className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-24 rounded-xl" />
          </div>
        ) : query.isError ? (
          <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive">
            {axiosErrorMessage(query.error)}
          </p>
        ) : !quota?.windows.length ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <IconGauge className="size-4" />
            {quota?.quota_note || 'No quota windows reported for this account.'}
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {quota.windows.map((quotaWindow) => (
              <QuotaWindowTile
                key={quotaWindow.key}
                quotaWindow={quotaWindow}
                asOf={query.dataUpdatedAt}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/** asOf is when the snapshot was fetched; the countdown is measured from it so
 * render stays pure, and the minute refetch keeps it current. */
function QuotaWindowTile({ quotaWindow, asOf }: { quotaWindow: QuotaWindow; asOf: number }) {
  const label = WINDOW_LABELS[quotaWindow.key] ?? { title: quotaWindow.key, hint: '' }
  const used = Math.min(100, Math.max(0, quotaWindow.utilization))
  const tone =
    used >= 90
      ? { bar: 'bg-red-500', text: 'text-red-500' }
      : used >= 70
        ? { bar: 'bg-amber-500', text: 'text-amber-500' }
        : { bar: 'bg-emerald-500', text: 'text-emerald-500' }
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
