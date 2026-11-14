import type { ColumnDef, RowData } from '@tanstack/react-table'

import { IconActivity, IconChevronRight } from '@tabler/icons-react'
import { Link } from '@tanstack/react-router'
import { useMemo } from 'react'

import type { HealthEntry, HealthStatus, ProbeEntry } from '@/lib/api/models/provider-health'

import ReactTable, { features } from '@/components/block/common/react-table'
import { HealthTimeline } from '@/components/block/dashboard/overview-provider-health'
import { getProviderBrand, ProviderAvatar } from '@/components/block/providers/provider-avatar'
import { usePaginationQuery } from '@/hooks/use-pagination-query'
import { formatDateTime } from '@/lib/date'
import { formatCount, formatMs } from '@/lib/format'
import { cn } from '@/lib/utils'

/** Page sizes of the health tables; the first is the default. */
export const HEALTH_PAGE_SIZES = [25, 50, 100]

export const STATUS_META: Record<HealthStatus, { label: string; pill: string; text: string }> = {
  healthy: {
    label: 'Healthy',
    pill: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    text: '',
  },
  degraded: {
    label: 'Degraded',
    pill: 'border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400',
    text: 'text-amber-600 dark:text-amber-400',
  },
  down: {
    label: 'Unhealthy',
    pill: 'border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400',
    text: 'text-red-600 dark:text-red-400',
  },
}

/** What a failure kind means for the operator, and what to try. */
const ISSUES: Record<string, { label: string; advice: string }> = {
  auth: {
    label: 'Auth error',
    advice: 'Re-check the API key or OAuth connection for this provider account.',
  },
  rate_limit: {
    label: 'Rate limited',
    advice: 'Lower the request rate or add another account to spread the load.',
  },
  quota_exhausted: {
    label: 'Quota exhausted',
    advice: 'Wait for the quota to reset or add another account.',
  },
  account_suspended: {
    label: 'Account suspended',
    advice: "Check the account's balance or plan with the provider.",
  },
  billing: { label: 'Billing problem', advice: "Check the account's balance or plan." },
  upstream: {
    label: 'Upstream errors',
    advice: 'The provider returned server errors. Check its status page.',
  },
  upstream_blocked: {
    label: 'Blocked upstream',
    advice: "The provider's edge rejected requests. Try another network or region.",
  },
  timeout: { label: 'Timeouts', advice: 'Requests timed out. Check latency or raise the timeout.' },
  capacity: {
    label: 'At capacity',
    advice: 'The provider is overloaded. Retry later or fall back.',
  },
  model_not_found: {
    label: 'Model not found',
    advice: 'Sync the model list or remove the model from routing.',
  },
  bad_request: { label: 'Bad requests', advice: 'Clients sent requests the provider rejected.' },
  context_too_large: {
    label: 'Context too large',
    advice: "Prompts exceed the model's context window.",
  },
}

/** Label and advice for an entry's main issue; null when nothing failed. */
export function issueOf(entry: HealthEntry) {
  if (!entry.mainIssue) {
    return entry.finalFailures + entry.fallbacks > 0 ? { label: 'Errors', advice: '' } : null
  }
  return (
    ISSUES[entry.mainIssue] ?? {
      label: entry.mainIssue.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()),
      advice: '',
    }
  )
}

export function StatusPill({ status }: { status: HealthStatus }) {
  const meta = STATUS_META[status]
  return (
    <span
      className={cn(
        'inline-flex h-5 items-center rounded-sm border px-[7px] text-[11.5px] font-medium',
        meta.pill
      )}
    >
      {meta.label}
    </span>
  )
}

type Column<T extends RowData> = ColumnDef<typeof features, T, unknown>

/** Empty state of a health table, inside the table's card. */
function Empty({ title, note }: { title: string; note: string }) {
  return (
    <div className="flex flex-col items-center px-6 py-9 text-center">
      <span className="flex size-10 items-center justify-center rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400">
        <IconActivity className="size-5" aria-hidden />
      </span>
      <p className="mt-2.5 text-[13px] font-semibold">{title}</p>
      <p className="mt-1 text-[12.5px] text-muted-foreground">{note}</p>
    </div>
  )
}

const TRAFFIC_NOTE = 'Rows appear once traffic flows through the gateway.'

/**
 * One health table. The rows are one page, cut by the server; the page is
 * kept in ?page like the other tables.
 */
function HealthTable<T extends RowData>({
  rows,
  total,
  columns,
  minWidth,
  empty,
}: {
  rows: T[]
  /** rows across every page */
  total: number
  columns: Column<T>[]
  minWidth: string
  empty: React.ReactNode
}) {
  const { limit, pageIndex } = usePaginationQuery({ defaultLimit: HEALTH_PAGE_SIZES[0] })
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <ReactTable
        data={rows}
        total={total}
        pageIndex={pageIndex}
        pageSize={limit}
        pageSizes={HEALTH_PAGE_SIZES}
        columns={columns}
        tableClassName={minWidth}
        emptyMessage={empty}
      />
    </div>
  )
}

const muted = (text: string) => <span className="text-muted-foreground">{text}</span>

function ProviderMark({ slug }: { slug: string }) {
  if (getProviderBrand(slug).icon) {
    return <ProviderAvatar slug={slug} size="sm" className="size-[22px] rounded-sm" />
  }
  return (
    <span className="flex size-[22px] shrink-0 items-center justify-center rounded-sm border border-border bg-muted font-mono text-[9px] font-medium text-muted-foreground uppercase">
      {slug.slice(0, 2)}
    </span>
  )
}

export function ProvidersHealthTable({
  entries,
  total,
  span,
  onOpen,
}: {
  entries: HealthEntry[]
  total: number
  span: string
  onOpen: (slug: string) => void
}) {
  const columns = useMemo<Column<HealthEntry>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Provider',
        meta: { headerClassName: 'w-[30%]', cellClassName: 'max-w-0' },
        cell: ({ row: { original: e } }) => {
          const n = e.accounts ?? 0
          return (
            <button
              type="button"
              onClick={() => onOpen(e.id)}
              className="flex w-full min-w-0 items-center gap-2.5 rounded-sm text-left"
            >
              <ProviderMark slug={e.id} />
              <span className="min-w-0">
                <span className="block truncate font-medium hover:underline">{e.name}</span>
                <span className="block truncate font-mono text-[11.5px] text-muted-foreground">
                  {e.id} · {n} {n === 1 ? 'account' : 'accounts'}
                </span>
              </span>
            </button>
          )
        },
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row: { original: e } }) => <StatusPill status={e.status} />,
      },
      {
        id: 'uptime',
        header: `Uptime · ${span}`,
        meta: { headerClassName: 'w-44' },
        cell: ({ row: { original: e } }) => (
          <HealthTimeline entry={e} span={span} className="w-40 gap-0.5" />
        ),
      },
      {
        accessorKey: 'requests',
        header: 'Requests',
        meta: { cellClassName: 'tabular-nums' },
        cell: ({ row: { original: e } }) => formatCount(e.requests),
      },
      {
        accessorKey: 'successRate',
        header: 'Success',
        cell: ({ row: { original: e } }) => (
          <span className={cn('tabular-nums', STATUS_META[e.status].text)}>
            {e.requests ? `${e.successRate.toFixed(1)}%` : '—'}
          </span>
        ),
      },
      {
        accessorKey: 'p95Ms',
        header: 'p95',
        meta: { cellClassName: 'text-muted-foreground tabular-nums' },
        cell: ({ row: { original: e } }) => (e.p95Ms ? formatMs(e.p95Ms) : '—'),
      },
      {
        id: 'issue',
        header: 'Main issue',
        meta: { headerClassName: 'w-[22%]' },
        cell: ({ row: { original: e } }) => {
          const issue = issueOf(e)
          if (!issue) return muted('—')
          return (
            <>
              <span className="block">{issue.label}</span>
              {issue.advice ? (
                <span className="block text-xs text-muted-foreground">{issue.advice}</span>
              ) : null}
            </>
          )
        },
      },
    ],
    [span, onOpen]
  )
  return (
    <HealthTable
      rows={entries}
      total={total}
      columns={columns}
      minWidth="min-w-[64rem]"
      empty={<Empty title="No provider traffic in this range" note={TRAFFIC_NOTE} />}
    />
  )
}

/** 0–100: success rate, discounted by how often another target had to step in. */
const scoreOf = (e: HealthEntry) => Math.round(e.successRate * (1 - e.fallbackRate / 100))

const MODEL_COLUMNS: Column<HealthEntry>[] = [
  {
    accessorKey: 'name',
    header: 'Model',
    meta: { headerClassName: 'w-[37%]', cellClassName: 'max-w-0' },
    cell: ({ row: { original: e } }) => {
      const slash = e.name.indexOf('/')
      return (
        <span className="block truncate font-mono text-[12.5px]" title={e.name}>
          <span className="text-muted-foreground">{e.name.slice(0, slash + 1)}</span>
          {e.name.slice(slash + 1)}
        </span>
      )
    },
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row: { original: e } }) => <StatusPill status={e.status} />,
  },
  {
    id: 'score',
    header: 'Score',
    cell: ({ row: { original: e } }) => {
      if (!e.requests) return muted('—')
      const score = scoreOf(e)
      return (
        <span className="flex items-center gap-2">
          <span className={cn('w-7 font-medium tabular-nums', STATUS_META[e.status].text)}>
            {score}
          </span>
          <span className="h-1.5 w-12 overflow-hidden rounded-full bg-muted" aria-hidden>
            <span
              className={cn(
                'block h-full',
                e.status === 'healthy'
                  ? 'bg-emerald-500'
                  : e.status === 'degraded'
                    ? 'bg-amber-500'
                    : 'bg-red-500'
              )}
              style={{ width: `${score}%` }}
            />
          </span>
        </span>
      )
    },
  },
  {
    accessorKey: 'successRate',
    header: 'Success',
    meta: { cellClassName: 'tabular-nums' },
    cell: ({ row: { original: e } }) => (e.requests ? `${e.successRate.toFixed(1)}%` : '—'),
  },
  {
    accessorKey: 'p95Ms',
    header: 'p95',
    meta: { cellClassName: 'tabular-nums' },
    cell: ({ row: { original: e } }) => (e.p95Ms ? formatMs(e.p95Ms) : '—'),
  },
  {
    accessorKey: 'fallbacks',
    header: 'Fallbacks',
    meta: { cellClassName: 'text-muted-foreground tabular-nums' },
    cell: ({ row: { original: e } }) => formatCount(e.fallbacks),
  },
  {
    id: 'issue',
    header: 'Main issue',
    meta: { cellClassName: 'text-muted-foreground' },
    cell: ({ row: { original: e } }) => issueOf(e)?.label ?? '—',
  },
]

export function ModelsHealthTable({ entries, total }: { entries: HealthEntry[]; total: number }) {
  return (
    <HealthTable
      rows={entries}
      total={total}
      columns={MODEL_COLUMNS}
      minWidth="min-w-[60rem]"
      empty={<Empty title="No model traffic in this range" note={TRAFFIC_NOTE} />}
    />
  )
}

export function ChainsHealthTable({
  entries,
  total,
  chainIds,
}: {
  entries: HealthEntry[]
  total: number
  /** chain id per name, for the detail link */
  chainIds: Map<string, string>
}) {
  const columns = useMemo<Column<HealthEntry>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Chain',
        meta: { headerClassName: 'w-[23%]', cellClassName: 'max-w-0' },
        cell: ({ row: { original: e } }) => (
          <span className="block truncate font-medium" title={e.name}>
            {e.name}
          </span>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row: { original: e } }) => <StatusPill status={e.status} />,
      },
      {
        accessorKey: 'requests',
        header: 'Requests',
        meta: { cellClassName: 'tabular-nums' },
        cell: ({ row: { original: e } }) => formatCount(e.requests),
      },
      {
        accessorKey: 'fallbackRate',
        header: 'Fallback rate',
        meta: { cellClassName: 'tabular-nums' },
        cell: ({ row: { original: e } }) => `${e.fallbackRate.toFixed(1)}%`,
      },
      {
        accessorKey: 'finalFailures',
        header: 'Final failures',
        meta: { cellClassName: 'text-muted-foreground tabular-nums' },
        cell: ({ row: { original: e } }) => formatCount(e.finalFailures),
      },
      {
        id: 'affected',
        header: 'Most affected',
        meta: { cellClassName: 'max-w-0' },
        cell: ({ row: { original: e } }) =>
          e.mostAffected ? (
            <code className="block truncate font-mono text-xs" title={e.mostAffected}>
              {e.mostAffected}
            </code>
          ) : (
            muted('—')
          ),
      },
      {
        // Same as the /chains table: a narrow last column, the link flush right.
        id: 'open',
        header: () => <span className="sr-only">Open</span>,
        meta: { headerClassName: 'w-12', cellClassName: 'text-right' },
        cell: ({ row: { original: e } }) => {
          const id = chainIds.get(e.name)
          return id ? (
            <Link
              to="/chains/$chainId"
              params={{ chainId: id }}
              aria-label={`Open chain ${e.name}`}
              className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <IconChevronRight className="size-4" />
            </Link>
          ) : null
        },
      },
    ],
    [chainIds]
  )
  return (
    <HealthTable
      rows={entries}
      total={total}
      columns={columns}
      minWidth="min-w-[52rem]"
      empty={<Empty title="No chains yet" note={TRAFFIC_NOTE} />}
    />
  )
}

const PROBE_COLUMNS: Column<ProbeEntry>[] = [
  {
    accessorKey: 'name',
    header: 'Probe',
    meta: { headerClassName: 'w-[28%]', cellClassName: 'max-w-0' },
    cell: ({ row: { original: p } }) => (
      <span className="block truncate font-medium" title={p.name}>
        {p.name}
      </span>
    ),
  },
  {
    accessorKey: 'target',
    header: 'Target',
    meta: { cellClassName: 'max-w-0' },
    cell: ({ row: { original: p } }) => (
      <code className="block truncate font-mono text-xs" title={p.target}>
        {p.target}
      </code>
    ),
  },
  {
    accessorKey: 'status',
    header: 'Result',
    cell: ({ row: { original: p } }) => (
      <StatusPill status={p.status === 'pass' ? 'healthy' : 'down'} />
    ),
  },
  {
    accessorKey: 'latencyMs',
    header: 'Latency',
    meta: { cellClassName: 'tabular-nums' },
    cell: ({ row: { original: p } }) => (p.latencyMs ? formatMs(p.latencyMs) : '—'),
  },
  {
    accessorKey: 'lastRun',
    header: 'Last run',
    meta: { cellClassName: 'text-muted-foreground whitespace-nowrap tabular-nums' },
    cell: ({ row: { original: p } }) => formatDateTime(p.lastRun),
  },
]

export function ProbesHealthTable({ entries }: { entries: ProbeEntry[] }) {
  return (
    <HealthTable
      rows={entries}
      total={entries.length}
      columns={PROBE_COLUMNS}
      minWidth="min-w-[48rem]"
      empty={
        <Empty
          title="No probes in this range"
          note="Scheduled health probes are not recorded yet."
        />
      }
    />
  )
}
