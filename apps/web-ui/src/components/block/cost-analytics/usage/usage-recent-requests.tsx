import type { ColumnDef } from '@tanstack/react-table'

import { IconBolt, IconSearch } from '@tabler/icons-react'
import { useQueryState } from 'nuqs'
import { useMemo, useState } from 'react'

import type { UsageTerminalRequestRow } from '@/lib/api/models/usage'

import EmptyState from '@/components/block/common/empty-state'
import ReactTable, { features } from '@/components/block/common/react-table'
import SectionCardPanel from '@/components/block/common/section-card-panel'
import { ProviderAvatar } from '@/components/block/providers/provider-avatar'
import { Input } from '@/components/ui/input'
import { usePaginationQuery } from '@/hooks/use-pagination-query'
import { formatMicrosUsd } from '@/lib/currency'
import { formatDateTime } from '@/lib/date'
import { formatCount, formatMs } from '@/lib/format'
import { cn } from '@/lib/utils'

import { Figure, FIGURE } from './figure'
import RequestDetailDialog from './request-detail-dialog'

type Row = UsageTerminalRequestRow

const STATUS: Record<Row['status'], { label: string; tone: string }> = {
  success: {
    label: 'Success',
    tone: 'bg-emerald-500/10 text-emerald-700 ring-emerald-500/25 dark:text-emerald-400',
  },
  failed: {
    label: 'Failed',
    tone: 'bg-destructive/10 text-red-700 ring-destructive/25 dark:text-red-400',
  },
  cancelled: { label: 'Cancelled', tone: 'text-muted-foreground ring-border' },
}

const USAGE: Record<Row['usage'], string> = {
  provider: 'Provider usage',
  estimate: 'Usage estimate',
  none: 'No usage reported',
}

const Chip = ({ label, tone }: { label: string; tone: string }) => (
  <span
    className={cn(
      'inline-flex h-5 items-center rounded-sm px-1.5 text-[11.5px] font-medium whitespace-nowrap ring-1 ring-inset',
      tone
    )}
  >
    {label}
  </span>
)

type ColumnType = ColumnDef<typeof features, Row, unknown>

const PAGE_SIZES = [25, 50, 100]

function requestColumns(onOpen: (row: Row) => void): ColumnType[] {
  return [
    {
      accessorKey: 'time',
      header: 'Time',
      meta: { headerClassName: 'w-px', cellClassName: 'align-top' },
      cell: ({ row: { original: row } }) => (
        <button
          type="button"
          onClick={() => onOpen(row)}
          title={formatDateTime(row.createdAt)}
          aria-label={`Open request #${row.id} from ${row.time}`}
          className="text-muted-foreground hover:text-foreground h-6 rounded-sm font-mono text-xs whitespace-nowrap underline-offset-2 hover:underline"
        >
          {row.time}
        </button>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      meta: { headerClassName: 'w-px', cellClassName: 'align-top' },
      cell: ({ row: { original: row } }) => (
        <div className="flex gap-1.5">
          <Chip {...STATUS[row.status]} />
          <Chip
            label={USAGE[row.usage]}
            tone="text-muted-foreground ring-border dark:bg-muted/40"
          />
        </div>
      ),
    },
    {
      accessorKey: 'model',
      header: 'Model',
      meta: { headerClassName: 'w-[34%]', cellClassName: 'max-w-0' },
      cell: ({ row: { original: row } }) => (
        <div className="flex min-w-0 items-center gap-2.5">
          <ProviderAvatar
            slug={row.provider}
            apiKind={row.api_kind}
            size="xs"
            className="size-5 rounded-[4px]"
          />
          <div className="min-w-0">
            <p className="truncate font-mono text-[12.5px]" title={row.model}>
              {row.model}
            </p>
            <p className="text-muted-foreground truncate text-[11.5px]">
              {row.providerName || row.provider}
              {row.keyName && ` · ${row.keyName}`}
            </p>
          </div>
        </div>
      ),
    },
    {
      id: 'tokens',
      header: 'Tokens in → out',
      meta: FIGURE,
      cell: ({ row: { original: row } }) => {
        const tokensIn = row.inputTokens + row.inputCacheRead + row.inputCacheWrite
        return <Figure value={`${formatCount(tokensIn)} → ${formatCount(row.outputTokens)}`} />
      },
    },
    {
      accessorKey: 'costMicros',
      header: 'Cost',
      meta: FIGURE,
      cell: ({ row: { original: row } }) => (
        <Figure
          value={
            row.costMicros === null
              ? row.costNote
                ? '$0.00'
                : '—'
              : formatMicrosUsd(row.costMicros)
          }
          detail={row.costNote ?? (row.costMicros === null ? 'Unpriced' : undefined)}
        />
      ),
    },
    {
      accessorKey: 'latencyMs',
      header: 'Latency',
      meta: FIGURE,
      cell: ({ row: { original: row } }) => (
        <Figure
          value={row.latencyMs > 0 ? formatMs(row.latencyMs) : '—'}
          // Only worth a line when upstream time was measured apart from the total.
          detail={
            row.upstreamMs > 0 && row.upstreamMs !== row.latencyMs
              ? `upstream ${formatMs(row.upstreamMs)}`
              : undefined
          }
        />
      ),
    },
  ]
}

export default function UsageRecentRequests({ rows }: { rows: Row[] }) {
  const [search, setSearch] = useState('')
  const [failedOnly, setFailedOnly] = useState(false)
  const [selected, setSelected] = useState<Row | null>(null)
  const failedCount = rows.filter((r) => r.status === 'failed').length
  // The list arrives whole, so filtering and paging run here.
  const { offset, limit, pageIndex } = usePaginationQuery({ defaultLimit: PAGE_SIZES[0] })
  const [, setPageParam] = useQueryState('page')
  const columns = useMemo(() => requestColumns(setSelected), [])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter(
      (r) =>
        (!failedOnly || r.status === 'failed') &&
        (!q ||
          [r.model, r.keyName, r.client, r.id, r.provider, r.providerName].some((v) =>
            v?.toLowerCase().includes(q)
          ))
    )
  }, [rows, search, failedOnly])

  const filters = [
    { label: 'All', count: rows.length, active: !failedOnly, failed: false },
    { label: 'Failed', count: failedCount, active: failedOnly, failed: true },
  ]

  return (
    <>
      <SectionCardPanel
        title="Recent requests"
        icon={IconBolt}
        toolbar={
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <div className="relative min-w-0 flex-1 sm:w-56 sm:flex-none">
              <IconSearch
                className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
                stroke={1.75}
                aria-hidden
              />
              <Input
                value={search}
                placeholder="Model, key, client or ID"
                aria-label="Filter by model, key, client or ID"
                className="h-8 pl-8 text-[13px]"
                onChange={(e) => {
                  setSearch(e.target.value)
                  void setPageParam(null)
                }}
              />
            </div>
            <div role="group" aria-label="Request status" className="flex gap-1">
              {filters.map((f) => (
                <button
                  key={f.label}
                  type="button"
                  aria-pressed={f.active}
                  onClick={() => {
                    setFailedOnly(f.failed)
                    void setPageParam(null)
                  }}
                  className={cn(
                    'inline-flex h-8 items-center gap-1.5 rounded-sm border px-2.5 text-xs font-medium transition-colors',
                    f.active
                      ? 'border-primary/30 bg-primary/10 text-primary'
                      : 'text-muted-foreground border-border hover:text-foreground'
                  )}
                >
                  {f.label}
                  <span className="tabular-nums">{f.count}</span>
                </button>
              ))}
            </div>
          </div>
        }
      >
        <ReactTable
          data={visible.slice(offset, offset + limit)}
          total={visible.length}
          pageIndex={pageIndex}
          pageSize={limit}
          pageSizes={PAGE_SIZES}
          columns={columns}
          tableClassName="min-w-[58rem]"
          emptyMessage={
            <EmptyState
              icon={IconBolt}
              title={rows.length === 0 ? 'No requests' : 'No requests match'}
              description={
                rows.length === 0
                  ? 'No requests in this period.'
                  : 'Try a different search or status filter.'
              }
              className="py-8"
            />
          }
        />
      </SectionCardPanel>

      {selected && <RequestDetailDialog open onClose={() => setSelected(null)} row={selected} />}
    </>
  )
}
