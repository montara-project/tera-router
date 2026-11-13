import type { ColumnDef } from '@tanstack/react-table'

import { IconGauge, IconLayoutGrid, IconList, IconRefresh } from '@tabler/icons-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import type { Models } from '@/lib/api/models'
import type {
  AccountQuota,
  ClineCredits,
  QuotaWindow,
  ZcodePlanQuotaRow,
} from '@/lib/api/models/account'

import ReactTable, { features } from '@/components/block/common/react-table'
import SectionCardPanel from '@/components/block/common/section-card-panel'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ButtonGroup, ButtonGroupItem } from '@/components/ui/button-group'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { usePaginationQuery } from '@/hooks/use-pagination-query'
import { axiosErrorMessage } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'
import { ACCOUNT_QUERY_KEY } from '@/lib/api/queries/account'
import { formatDate, formatUptime, formatTimeAgo } from '@/lib/date'
import { formatCompact } from '@/lib/format'

/** Display names for the windows Anthropic reports; unknown keys show raw.
 * `short` is the label of the list view's narrow meter. */
const WINDOW_LABELS: Record<string, { title: string; short: string; hint: string }> = {
  five_hour: { title: 'Session', short: 'Session', hint: 'Rolling 5-hour window' },
  seven_day: { title: 'Weekly · all models', short: 'Weekly', hint: '7-day window' },
  seven_day_sonnet: { title: 'Weekly · Sonnet', short: 'Sonnet', hint: '7-day window' },
  seven_day_opus: { title: 'Weekly · Opus', short: 'Opus', hint: '7-day window' },
}

/** Anthropic recomputes usage continuously; one minute keeps the bars and
 * reset countdowns fresh without hammering the endpoint. */
const REFRESH_MS = 60_000

/** Twelve fills whole rows of the two- and three-column grid. */
const PAGE_SIZES = [12, 24, 48, 96]

type QuotaView = 'grid' | 'list'

const VIEW_STORAGE_KEY = 'quotaPanelView'

/** The chosen view is a per-browser preference, kept across providers. */
function useQuotaView(): [QuotaView, (view: QuotaView) => void] {
  const [view, setView] = useState<QuotaView>(() => {
    try {
      return localStorage.getItem(VIEW_STORAGE_KEY) === 'list' ? 'list' : 'grid'
    } catch {
      return 'grid'
    }
  })
  const change = (next: QuotaView) => {
    setView(next)
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, next)
    } catch {
      // storage unavailable: the choice lasts for this visit
    }
  }
  return [view, change]
}

/** One account's live quota. Every cell and card of an account shares the
 * query, so it is fetched once however many places read it. */
function useAccountQuota(account: Models.Account) {
  return useQuery({ ...queries.accounts.quota(account.id), refetchInterval: REFRESH_MS })
}

function isCline(account: Models.Account) {
  return account.provider === 'cline' || account.provider === 'clinepayg'
}

function limitsLabel(account: Models.Account) {
  if (account.provider === 'zcode') return 'ZCode Plan grants'
  if (isCline(account)) return 'Cline credit balance'
  return 'Subscription limits'
}

/**
 * QuotaPanel shows what each account's upstream reports is left of its
 * allowance: Claude's rolling session and weekly windows, the ZCode plan
 * grants (billing/balance merged per entitlement), or the Cline credit
 * balance. The grid gives every account a card; the list puts the same
 * meters in aligned rows for comparing many accounts. Both are paged, and
 * only the accounts on the page are fetched.
 */
export default function QuotaPanel({ accounts }: { accounts: Models.Account[] }) {
  const qc = useQueryClient()
  const [view, setView] = useQuotaView()
  const { offset, limit, pageIndex } = usePaginationQuery({ defaultLimit: PAGE_SIZES[0] })
  const paged = accounts.slice(offset, offset + limit)

  const columns: ColumnDef<typeof features, Models.Account, unknown>[] = [
    {
      id: 'account',
      header: 'Account',
      meta: { cellClassName: 'max-w-0 w-[30%]' },
      cell: ({ row }) => <AccountName account={row.original} />,
    },
    {
      id: 'remaining',
      header: 'Remaining',
      cell: ({ row }) => <QuotaMeters account={row.original} dense />,
    },
    {
      id: 'reset',
      header: 'Next reset',
      meta: { headerClassName: 'w-40' },
      cell: ({ row }) => <NextResetCell account={row.original} />,
    },
    {
      id: 'actions',
      header: () => <span className="sr-only">Actions</span>,
      meta: { headerClassName: 'w-12' },
      cell: ({ row }) => (
        <div className="flex justify-end">
          <RefreshButton account={row.original} />
        </div>
      ),
    },
  ]

  return (
    <SectionCardPanel
      icon={IconGauge}
      title={
        <>
          Quota
          <span className="font-normal text-muted-foreground">
            {accounts.length} {accounts.length === 1 ? 'account' : 'accounts'}
          </span>
        </>
      }
      toolbar={
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => void qc.invalidateQueries({ queryKey: [ACCOUNT_QUERY_KEY, 'quota'] })}
          >
            <IconRefresh /> Refresh
          </Button>
          <ButtonGroup
            type="single"
            size="xs"
            value={view}
            onValueChange={(next) => next && setView(next as QuotaView)}
            aria-label="Quota layout"
          >
            <ButtonGroupItem value="grid" aria-label="Grid view" title="Grid view">
              <IconLayoutGrid />
            </ButtonGroupItem>
            <ButtonGroupItem value="list" aria-label="List view" title="List view">
              <IconList />
            </ButtonGroupItem>
          </ButtonGroup>
        </div>
      }
    >
      <ReactTable
        total={accounts.length}
        data={paged}
        pageIndex={pageIndex}
        pageSize={limit}
        pageSizes={PAGE_SIZES}
        columns={columns}
        tableClassName="min-w-[44rem]"
        body={
          view === 'grid' ? (
            <div className="grid gap-4 p-4 md:grid-cols-2 2xl:grid-cols-3">
              {paged.map((account) => (
                <AccountQuotaCard key={account.id} account={account} />
              ))}
            </div>
          ) : undefined
        }
      />
    </SectionCardPanel>
  )
}

function AccountName({ account }: { account: Models.Account }) {
  const name = account.label || 'API key'
  return (
    <>
      <p className="flex items-center gap-2 font-medium">
        <span className="truncate" title={name}>
          {name}
        </span>
        {account.needs_reconnect ? (
          <Badge variant="destructive" appearance="light" size="sm">
            Reconnect required
          </Badge>
        ) : null}
      </p>
      {account.key_fingerprint ? (
        <p className="truncate font-mono text-xs text-muted-foreground">
          {account.key_fingerprint}
        </p>
      ) : null}
    </>
  )
}

function RefreshButton({ account }: { account: Models.Account }) {
  const query = useAccountQuota(account)
  return (
    <Button
      size="icon"
      variant="ghost"
      className="size-8 shrink-0"
      aria-label={`Refresh ${account.label || 'account'} quota`}
      disabled={query.isFetching}
      onClick={() => void query.refetch()}
    >
      <IconRefresh className={query.isFetching ? 'animate-spin' : undefined} />
    </Button>
  )
}

/** Grid view: one card per account, its meters stacked. */
function AccountQuotaCard({ account }: { account: Models.Account }) {
  const query = useAccountQuota(account)
  const fetchedAt = query.data?.data.fetched_at
  const label = limitsLabel(account)

  return (
    <article className="flex min-w-0 flex-col rounded-lg border border-border bg-background">
      <header className="flex items-start justify-between gap-2 border-b border-border py-2.5 ps-4 pe-2">
        <div className="min-w-0">
          <AccountName account={account} />
          <p className="truncate text-xs text-muted-foreground">
            {fetchedAt ? `${label} · updated ${formatTimeAgo(fetchedAt)}` : label}
          </p>
        </div>
        <RefreshButton account={account} />
      </header>
      <div className="flex-1 p-4">
        <QuotaMeters account={account} />
      </div>
    </article>
  )
}

/**
 * What is left on one account, in whichever shape its upstream reports.
 * `dense` is the list view: one line per meter, with fixed-width labels and
 * figures so the bars of different accounts line up.
 */
function QuotaMeters({ account, dense = false }: { account: Models.Account; dense?: boolean }) {
  const query = useAccountQuota(account)
  const quota = query.data?.data

  if (query.isLoading) {
    return dense ? (
      <Skeleton className="h-4 w-full max-w-md" />
    ) : (
      <div className="space-y-3">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-2 w-full" />
      </div>
    )
  }

  if (query.isError) {
    return (
      <p className={dense ? 'text-xs text-destructive' : 'text-sm text-destructive'}>
        {axiosErrorMessage(query.error)}
      </p>
    )
  }

  if (account.provider === 'zcode' && quota?.rows?.length) {
    return (
      <div className={dense ? 'space-y-1.5' : 'space-y-4'}>
        {!dense && quota.source === 'current' ? (
          <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
            Live usage is unavailable right now — showing plan definitions only.
          </p>
        ) : null}
        {!dense && quota.errors?.length ? (
          <p className="text-xs text-muted-foreground">{quota.errors.join(' · ')}</p>
        ) : null}
        {quota.rows.map((row) => (
          <ZcodeGrantMeter key={row.entitlement_id || row.model} row={row} dense={dense} />
        ))}
      </div>
    )
  }

  if (quota?.credits) {
    return <ClineCredit credits={quota.credits} dense={dense} />
  }

  if (quota?.windows.length) {
    return (
      <div className={dense ? 'space-y-1.5' : 'space-y-4'}>
        {quota.windows.map((quotaWindow) => (
          <WindowMeter
            key={quotaWindow.key}
            quotaWindow={quotaWindow}
            asOf={query.dataUpdatedAt}
            dense={dense}
          />
        ))}
      </div>
    )
  }

  return (
    <p className={`flex items-center gap-2 text-muted-foreground ${dense ? 'text-xs' : 'text-sm'}`}>
      <IconGauge className="size-4 shrink-0" />
      {quota?.errors?.length
        ? quota.errors.join(' · ')
        : quota?.quota_note || 'No quota reported for this account.'}
    </p>
  )
}

function usageTone(used: number) {
  if (used >= 90) return { bar: 'bg-red-500', text: 'text-red-500' }
  if (used >= 70) return { bar: 'bg-amber-500', text: 'text-amber-500' }
  return { bar: 'bg-emerald-500', text: 'text-emerald-500' }
}

/**
 * One meter: a name, how much is left, and a bar that empties as the
 * allowance is used, coloured by how close it is to running out. The dense
 * form is the list view's single line; the full form adds a detail line.
 */
function Meter({
  title,
  used,
  left,
  detail,
  dense,
}: {
  title: string
  /** percent used, 0–100; null hides the bar */
  used: number | null
  /** what is left, already worded ("38% left") */
  left: string
  detail: string
  dense: boolean
}) {
  const tone = usageTone(used ?? 0)

  if (dense) {
    return (
      <div className="flex items-center gap-3" title={detail}>
        <span className="w-20 shrink-0 truncate text-xs text-muted-foreground">{title}</span>
        {used !== null ? (
          <Progress
            value={100 - used}
            className="h-1.5 max-w-64 flex-1"
            indicatorClassName={tone.bar}
          />
        ) : (
          <span className="max-w-64 flex-1" />
        )}
        <span
          className={`w-24 shrink-0 text-right text-xs font-medium tabular-nums ${used !== null ? tone.text : 'text-muted-foreground'}`}
        >
          {left}
        </span>
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="truncate text-sm font-medium">{title}</p>
        <span
          className={`shrink-0 text-sm font-semibold tabular-nums ${used !== null ? tone.text : 'text-muted-foreground'}`}
        >
          {left}
        </span>
      </div>
      {used !== null ? (
        <Progress value={100 - used} className="h-2" indicatorClassName={tone.bar} />
      ) : null}
      <p className="text-xs tabular-nums text-muted-foreground">{detail}</p>
    </div>
  )
}

/** asOf is when the snapshot was fetched; the countdown is measured from it so
 * render stays pure, and the minute refetch keeps it current. */
function WindowMeter({
  quotaWindow,
  asOf,
  dense,
}: {
  quotaWindow: QuotaWindow
  asOf: number
  dense: boolean
}) {
  const label = WINDOW_LABELS[quotaWindow.key]
  const used = Math.min(100, Math.max(0, quotaWindow.utilization))
  const resetsAt = quotaWindow.resets_at
  const secondsLeft = resetsAt
    ? Math.max(0, Math.round((new Date(resetsAt).getTime() - asOf) / 1000))
    : null
  const reset =
    resetsAt && secondsLeft !== null
      ? `resets in ${formatUptime(secondsLeft)} · ${formatDate(resetsAt, 'EEE dd MMM, HH:mm')}`
      : 'no reset scheduled'

  return (
    <Meter
      title={(dense ? label?.short : label?.title) ?? quotaWindow.key}
      used={used}
      left={`${Math.round(100 - used)}% left`}
      detail={`${Math.round(used)}% used · ${reset}`}
      dense={dense}
    />
  )
}

/** A ZCode plan grant: the model, and its usage against the grant. */
function ZcodeGrantMeter({ row, dense }: { row: ZcodePlanQuotaRow; dense: boolean }) {
  const model =
    row.model ||
    (Array.isArray(row.models) && typeof row.models[0] === 'string' ? row.models[0] : '') ||
    'Unknown model'
  const plan = row.plan_name || row.plan || row.plan_id
  const total = typeof row.total_units === 'number' ? row.total_units : null
  const used = typeof row.used_units === 'number' ? row.used_units : null
  const remaining =
    typeof row.remaining_units === 'number'
      ? row.remaining_units
      : total !== null && used !== null
        ? Math.max(0, total - used)
        : null
  const unit = typeof row.unit_type === 'string' ? row.unit_type : 'units'
  const percent = total && total > 0 && used !== null ? Math.min(100, (used / total) * 100) : null
  const periodEnd =
    typeof row.period_end === 'number' ? new Date(row.period_end * 1000).toISOString() : null

  const usage =
    used !== null && total !== null
      ? `${formatCompact(used)} / ${formatCompact(total)} ${unit} used`
      : total !== null
        ? `${formatCompact(total)} ${unit} granted`
        : 'no usage reported'
  const detail = [
    plan,
    row.period ? `${String(row.period)} window` : '',
    usage,
    periodEnd ? `resets ${formatDate(periodEnd, 'EEE dd MMM, HH:mm')}` : '',
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <Meter
      title={model}
      used={percent}
      left={remaining !== null ? `${formatCompact(remaining)} left` : '—'}
      detail={detail}
      dense={dense}
    />
  )
}

const CREDITS_FORMAT = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
})

/** The Cline credit balance; a negative balance means usage has overdrawn it. */
function ClineCredit({ credits, dense }: { credits: ClineCredits; dense: boolean }) {
  const overdrawn = credits.balance < 0
  const tone = overdrawn ? 'text-red-500' : 'text-foreground'
  const note = overdrawn
    ? 'Negative: usage has gone past the credits added.'
    : 'Reported by Cline for the account behind this key.'

  if (dense) {
    return (
      <div className="flex items-center gap-3" title={note}>
        <span className="w-20 shrink-0 text-xs text-muted-foreground">Credits</span>
        <span className={`text-sm font-semibold tabular-nums ${tone}`}>
          {CREDITS_FORMAT.format(credits.balance)}
        </span>
      </div>
    )
  }

  return (
    <div className="space-y-1">
      <p className="text-sm font-medium">Credit balance</p>
      <p className={`text-2xl font-semibold tabular-nums ${tone}`}>
        {CREDITS_FORMAT.format(credits.balance)}
      </p>
      <p className="text-xs text-muted-foreground">{note}</p>
    </div>
  )
}

/** The soonest reset among an account's windows and grants, in ms. */
function nextReset(quota: AccountQuota | undefined): number | null {
  const times: number[] = []
  for (const w of quota?.windows ?? []) {
    if (w.resets_at) times.push(new Date(w.resets_at).getTime())
  }
  for (const row of quota?.rows ?? []) {
    if (typeof row.period_end === 'number') times.push(row.period_end * 1000)
  }
  return times.length ? Math.min(...times) : null
}

function NextResetCell({ account }: { account: Models.Account }) {
  const query = useAccountQuota(account)
  const quota = query.data?.data

  if (query.isLoading) return <Skeleton className="h-4 w-20" />

  const resetAt = nextReset(quota)
  const secondsLeft =
    resetAt !== null ? Math.max(0, Math.round((resetAt - query.dataUpdatedAt) / 1000)) : null

  return (
    <>
      <p className="tabular-nums">
        {secondsLeft !== null ? `in ${formatUptime(secondsLeft)}` : '—'}
      </p>
      {quota?.fetched_at ? (
        <p className="text-xs text-muted-foreground">updated {formatTimeAgo(quota.fetched_at)}</p>
      ) : null}
    </>
  )
}
