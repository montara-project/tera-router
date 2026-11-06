import type { ColumnDef } from '@tanstack/react-table'

import { IconBolt } from '@tabler/icons-react'

import type { UsageTerminalRequestRow } from '@/lib/api/models/usage'

import EmptyState from '@/components/block/common/empty-state'
import ReactTable, { features } from '@/components/block/common/react-table'
import SectionCardPanel from '@/components/block/common/section-card-panel'
import { ProviderAvatar } from '@/components/block/providers/provider-avatar'
import { formatMicrosUsd } from '@/lib/currency'
import { formatClock, formatDate } from '@/lib/date'
import { formatCount, formatMs } from '@/lib/format'
import { cn } from '@/lib/utils'

const LIMIT = 8

/** Upstream failure classes (server core.ErrorKind) as short badge labels. */
const ERROR_LABELS: Record<string, string> = {
  auth: 'Auth error',
  rate_limit: 'Rate limit',
  quota_exhausted: 'Quota exhausted',
  account_suspended: 'Account suspended',
  upstream: 'Upstream error',
  upstream_blocked: 'Upstream blocked',
  timeout: 'Timeout',
  bad_request: 'Bad request',
  context_too_large: 'Context too large',
  capability: 'Model unavailable',
  budget_blocked: 'Budget blocked',
}

function statusLabel(row: UsageTerminalRequestRow) {
  if (row.status === 'success') return 'Success'
  if (row.status === 'cancelled') return 'Cancelled'
  return ERROR_LABELS[row.errorKind ?? ''] ?? 'Failed'
}

/** Today's requests show the clock time; older ones the date too. */
function requestTime(iso: string) {
  const at = new Date(iso)
  return at.toDateString() === new Date().toDateString()
    ? formatClock(at)
    : formatDate(at, 'MMM d, HH:mm')
}

type ColumnType = ColumnDef<typeof features, UsageTerminalRequestRow, unknown>

const RIGHT = {
  headerClassName: 'text-right whitespace-nowrap',
  cellClassName: 'text-right whitespace-nowrap tabular-nums',
}
const RIGHT_MUTED = { ...RIGHT, cellClassName: `${RIGHT.cellClassName} text-muted-foreground` }

const COLUMNS: ColumnType[] = [
  {
    accessorKey: 'createdAt',
    header: 'Time',
    meta: {
      cellClassName: 'text-muted-foreground font-mono text-xs whitespace-nowrap tabular-nums',
    },
    cell: ({ row }) => (
      <time dateTime={row.original.createdAt}>{requestTime(row.original.createdAt)}</time>
    ),
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => {
      const ok = row.original.status === 'success'
      return (
        <span
          className={cn(
            'inline-flex rounded-sm px-1.5 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset',
            ok
              ? 'bg-emerald-500/10 text-emerald-700 ring-emerald-500/25 dark:text-emerald-400'
              : 'bg-destructive/10 text-red-700 ring-destructive/25 dark:text-red-400'
          )}
          title={row.original.errorStatus ? `HTTP ${row.original.errorStatus}` : undefined}
        >
          {statusLabel(row.original)}
        </span>
      )
    },
  },
  {
    accessorKey: 'model',
    header: 'Model',
    meta: { headerClassName: 'w-2/5', cellClassName: 'max-w-0' },
    cell: ({ row }) => (
      <div className="flex min-w-0 items-center gap-2.5">
        <ProviderAvatar slug={row.original.provider} apiKind={row.original.api_kind} size="xs" />
        <div className="min-w-0 font-mono">
          <p className="truncate" title={row.original.model}>
            {row.original.model}
          </p>
          <p className="text-muted-foreground truncate text-xs">
            {row.original.provider} · {row.original.client || 'unknown'}
          </p>
        </div>
      </div>
    ),
  },
  {
    accessorKey: 'latencyMs',
    header: 'Latency',
    meta: RIGHT,
    cell: ({ row }) => (row.original.latencyMs > 0 ? formatMs(row.original.latencyMs) : '—'),
  },
  {
    id: 'tokens',
    header: 'Tokens in → out',
    meta: RIGHT_MUTED,
    cell: ({ row }) => {
      const r = row.original
      const tokensIn = r.inputTokens + r.inputCacheRead + r.inputCacheWrite
      return tokensIn + r.outputTokens > 0
        ? `${formatCount(tokensIn)} → ${formatCount(r.outputTokens)}`
        : '—'
    },
  },
  {
    accessorKey: 'costMicros',
    header: 'Cost',
    meta: RIGHT_MUTED,
    cell: ({ row }) =>
      row.original.costMicros === null ? '—' : formatMicrosUsd(row.original.costMicros),
  },
]

export default function OverviewRecentRequests({ rows }: { rows: UsageTerminalRequestRow[] }) {
  const visible = rows.slice(0, LIMIT)

  return (
    <SectionCardPanel
      title="Recent requests"
      icon={IconBolt}
      action={{ label: 'All requests', to: '/usage' }}
    >
      <ReactTable
        data={visible}
        total={visible.length}
        pageSize={LIMIT}
        columns={COLUMNS}
        pagination={false}
        tableClassName="min-w-[44rem]"
        emptyMessage={
          <EmptyState
            icon={IconBolt}
            title="No requests yet"
            description="Requests through the gateway show up here."
            className="py-8"
          />
        }
      />
    </SectionCardPanel>
  )
}
