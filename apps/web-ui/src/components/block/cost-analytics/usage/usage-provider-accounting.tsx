import type { ColumnDef } from '@tanstack/react-table'

import { IconPackages } from '@tabler/icons-react'
import { Link } from '@tanstack/react-router'

import type { UsageProviderAccountingRow } from '@/lib/api/models/usage'

import EmptyState from '@/components/block/common/empty-state'
import ReactTable, { features } from '@/components/block/common/react-table'
import DashboardPanel from '@/components/block/dashboard/dashboard-panel'
import { HealthBadge } from '@/components/block/dashboard/overview-provider-health'
import { ProviderAvatar } from '@/components/block/providers/provider-avatar'
import { usePaginationQuery } from '@/hooks/use-pagination-query'
import { formatMicrosUsd } from '@/lib/currency'
import { formatCompact, formatCount, formatMs } from '@/lib/format'

import { Figure, FIGURE } from './figure'

type Row = UsageProviderAccountingRow
type ColumnType = ColumnDef<typeof features, Row, unknown>

const PAGE_SIZES = [10, 25, 50, 100]

const COLUMNS: ColumnType[] = [
  {
    accessorKey: 'provider',
    header: 'Provider',
    meta: { headerClassName: 'w-[30%]', cellClassName: 'max-w-0' },
    cell: ({ row: { original: row } }) => (
      <div className="flex min-w-0 items-center gap-2.5">
        <ProviderAvatar
          slug={row.slug}
          apiKind={row.api_kind}
          size="xs"
          className="size-[22px] rounded-[4px]"
        />
        <div className="flex min-w-0 flex-col items-start gap-0.5">
          {row.detailId ? (
            <Link
              to="/providers/$providerId"
              params={{ providerId: row.detailId }}
              className="max-w-full truncate rounded-sm text-[13px] font-medium hover:underline"
              title={row.provider}
            >
              {row.provider}
            </Link>
          ) : (
            <span className="max-w-full truncate text-[13px] font-medium" title={row.provider}>
              {row.provider}
            </span>
          )}
          <HealthBadge status={row.status} />
        </div>
      </div>
    ),
  },
  {
    accessorKey: 'requests',
    header: 'Requests',
    meta: FIGURE,
    cell: ({ row: { original: row } }) => (
      <Figure
        value={formatCount(row.requests)}
        detail={`${row.successPct.toFixed(1)}% ok · ${formatCount(row.failed)} failed`}
      />
    ),
  },
  {
    accessorKey: 'inputTokens',
    header: 'Input',
    meta: FIGURE,
    cell: ({ row: { original: row } }) => (
      <Figure
        value={formatCompact(row.inputTokens)}
        detail={`${formatCompact(row.cacheReadTokens)} cache read · ${formatCompact(row.cacheWriteTokens)} write`}
      />
    ),
  },
  {
    accessorKey: 'outputTokens',
    header: 'Output',
    meta: FIGURE,
    cell: ({ row: { original: row } }) => (
      <Figure
        value={formatCompact(row.outputTokens)}
        detail={`${formatCompact(row.reasoningTokens)} reasoning`}
      />
    ),
  },
  {
    accessorKey: 'costMicros',
    header: 'Cost',
    meta: FIGURE,
    cell: ({ row: { original: row } }) => (
      <Figure
        value={formatMicrosUsd(row.costMicros)}
        detail={`${formatMicrosUsd(row.savedMicros)} saved`}
      />
    ),
  },
  {
    accessorKey: 'latencyMs',
    header: 'Latency',
    meta: FIGURE,
    cell: ({ row: { original: row } }) => (
      <Figure
        value={row.requests - row.failed > 0 ? formatMs(row.latencyMs) : '—'}
        detail={`TTFT ${row.ttftMs > 0 ? formatMs(row.ttftMs) : '—'} · p95 ${row.p95Ms > 0 ? formatMs(row.p95Ms) : '—'}`}
      />
    ),
  },
  {
    accessorKey: 'coverage',
    header: 'Priced',
    meta: FIGURE,
    cell: ({ row: { original: row } }) =>
      row.requests - row.failed > 0 ? (
        <Figure
          value={`${row.coverage.toFixed(0)}%`}
          detail={`${formatCount(row.pricingEst)} of ${formatCount(row.requests)} priced`}
        />
      ) : (
        <Figure value="—" detail="Nothing to price" />
      ),
  },
]

export default function UsageProviderAccounting({ rows }: { rows: Row[] }) {
  // The list arrives whole, so paging runs here; the pager keeps ?page.
  const { offset, limit, pageIndex } = usePaginationQuery({ defaultLimit: PAGE_SIZES[0] })

  return (
    <DashboardPanel
      title="Provider accounting"
      icon={IconPackages}
      action={{ label: 'Provider health', to: '/provider-health' }}
    >
      <ReactTable
        data={rows.slice(offset, offset + limit)}
        total={rows.length}
        pageIndex={pageIndex}
        pageSize={limit}
        pageSizes={PAGE_SIZES}
        columns={COLUMNS}
        tableClassName="min-w-[60rem]"
        emptyMessage={
          <EmptyState
            icon={IconPackages}
            title="No provider traffic"
            description="No provider served requests in this period."
            className="py-8"
          />
        }
      />
    </DashboardPanel>
  )
}
