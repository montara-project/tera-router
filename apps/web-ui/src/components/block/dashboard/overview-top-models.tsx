import type { ColumnDef } from '@tanstack/react-table'

import { IconBrain } from '@tabler/icons-react'
import { useMemo } from 'react'

import type { UsageModelAccountingRow, UsageTelemetryOverview } from '@/lib/api/models/usage'

import EmptyState from '@/components/block/common/empty-state'
import ReactTable, { features } from '@/components/block/common/react-table'
import DashboardPanel from '@/components/block/dashboard/dashboard-panel'
import { ProviderAvatar } from '@/components/block/providers/provider-avatar'
import { formatMicrosUsd } from '@/lib/currency'
import { formatCompact, formatCount } from '@/lib/format'

const LIMIT = 6

type ColumnType = ColumnDef<typeof features, UsageModelAccountingRow, unknown>

const RIGHT = { headerClassName: 'text-right', cellClassName: 'text-right tabular-nums' }

function topModelColumns(total: number): ColumnType[] {
  return [
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
            <p className="text-muted-foreground truncate text-xs" title={row.original.provider}>
              {row.original.provider}
            </p>
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'requests',
      header: 'Requests',
      meta: RIGHT,
      cell: ({ row }) => formatCount(row.original.requests),
    },
    {
      id: 'tokens',
      header: 'Tokens',
      meta: RIGHT,
      cell: ({ row }) =>
        formatCompact(
          row.original.inputTokens + row.original.cachedTokens + row.original.outputTokens
        ),
    },
    {
      id: 'cost',
      header: 'Cost',
      meta: { ...RIGHT, cellClassName: 'text-right tabular-nums text-muted-foreground' },
      cell: ({ row }) =>
        row.original.costMicros === null ? '—' : formatMicrosUsd(row.original.costMicros),
    },
    {
      id: 'share',
      header: 'Share',
      meta: {
        headerClassName: 'w-40',
        cellClassName: 'text-right text-xs tabular-nums text-muted-foreground',
      },
      cell: ({ row }) => {
        const share = total > 0 ? (row.original.requests / total) * 100 : 0
        return (
          <>
            <span
              className="bg-muted mr-3 inline-block h-1.5 w-[calc(100%-3rem)] overflow-hidden rounded-full align-middle"
              aria-hidden
            >
              <span
                className="bg-primary block h-full rounded-full"
                style={{ width: `${share}%` }}
              />
            </span>
            {Math.round(share)}%
          </>
        )
      },
    },
  ]
}

export default function OverviewTopModels({ telemetry }: { telemetry: UsageTelemetryOverview }) {
  const total = telemetry.traffic.requests
  const rows = useMemo(
    () => [...telemetry.modelAccounting].sort((a, b) => b.requests - a.requests).slice(0, LIMIT),
    [telemetry.modelAccounting]
  )
  const columns = useMemo(() => topModelColumns(total), [total])

  return (
    <DashboardPanel
      title="Top models"
      icon={IconBrain}
      action={{ label: 'All models', to: '/usage' }}
    >
      <ReactTable
        data={rows}
        total={rows.length}
        pageSize={LIMIT}
        columns={columns}
        pagination={false}
        tableClassName="min-w-[36rem]"
        emptyMessage={
          <EmptyState
            icon={IconBrain}
            title="No model traffic"
            description="No model served requests in this period."
            className="py-8"
          />
        }
      />
    </DashboardPanel>
  )
}
