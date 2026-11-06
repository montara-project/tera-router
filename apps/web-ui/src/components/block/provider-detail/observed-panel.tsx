import type { ColumnDef } from '@tanstack/react-table'

import { IconActivity, IconSearch } from '@tabler/icons-react'
import { useQueryState } from 'nuqs'
import { useState } from 'react'

import type { Models } from '@/lib/api/models'

import EmptyState from '@/components/block/common/empty-state'
import ReactTable, { features } from '@/components/block/common/react-table'
import SectionCardPanel from '@/components/block/common/section-card-panel'
import { RouteAsCell } from '@/components/block/provider-detail/model-row'
import { Button } from '@/components/ui/button'
import { Input, InputWrapper } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { usePaginationQuery } from '@/hooks/use-pagination-query'
import { formatMicrosUsd } from '@/lib/currency'
import { formatCompact, formatCount, formatLatency } from '@/lib/format'

/** The pager never offers fewer than 10 rows. */
const PAGE_SIZES = [10, 25, 50, 100]

/** Models this provider actually served in the last 30 days, from usage accounting. */
export default function ObservedPanel({
  models,
  loading,
}: {
  models: Models.UsageModelAccountingRow[]
  loading: boolean
}) {
  const [search, setSearchValue] = useState('')
  // The list arrives whole, so search and paging run here; the pager keeps its page in ?page.
  const { offset, limit, pageIndex } = usePaginationQuery()
  const [, setPageParam] = useQueryState('page')
  // A new search re-pages the list, so drop a stale page index.
  const setSearch = (value: string) => {
    setSearchValue(value)
    void setPageParam(null)
  }
  const q = search.trim().toLowerCase()
  const rows = models.filter((m) => !q || m.model.toLowerCase().includes(q))

  const renderBody = () => {
    if (loading) {
      return (
        <div className="space-y-2 p-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
      )
    }

    if (models.length === 0) {
      return (
        <EmptyState
          className="border-0"
          icon={IconActivity}
          title="No observed models yet"
          description="Models appear here after this provider serves traffic. The Catalog tab lists every model the provider exposes."
        />
      )
    }

    if (rows.length === 0) {
      return (
        <EmptyState
          className="border-0"
          icon={IconSearch}
          title="No models match"
          description="Try a shorter name."
          action={
            <Button size="sm" variant="outline" onClick={() => setSearch('')}>
              Clear filter
            </Button>
          }
        />
      )
    }

    return (
      <ReactTable
        total={rows.length}
        data={rows.slice(offset, offset + limit)}
        pageIndex={pageIndex}
        pageSize={limit}
        pageSizes={PAGE_SIZES}
        columns={COLUMNS}
        tableClassName="min-w-[52rem]"
      />
    )
  }

  return (
    <SectionCardPanel
      icon={IconActivity}
      title={
        <>
          Observed
          <span className="font-normal text-muted-foreground">last 30 days</span>
        </>
      }
    >
      {models.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5">
          <InputWrapper className="w-full sm:w-64">
            <IconSearch aria-hidden />
            <Input
              type="search"
              aria-label="Filter models"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter models"
            />
          </InputWrapper>
          <span className="ms-auto text-[12.5px] text-muted-foreground tabular-nums">
            {q ? `${rows.length} of ${models.length} shown` : `${models.length} shown`}
          </span>
        </div>
      )}
      {renderBody()}
    </SectionCardPanel>
  )
}

const RIGHT = { headerClassName: 'text-right', cellClassName: 'text-right tabular-nums' }

const COLUMNS: ColumnDef<typeof features, Models.UsageModelAccountingRow, unknown>[] = [
  {
    id: 'model',
    header: 'Model',
    meta: { headerClassName: 'w-[26%]', cellClassName: 'max-w-0' },
    cell: ({ row }) => (
      <span className="block truncate font-medium" title={row.original.model}>
        {row.original.model}
      </span>
    ),
  },
  {
    id: 'route_as',
    header: 'Route as',
    meta: { headerClassName: 'w-[30%]', cellClassName: 'max-w-0' },
    cell: ({ row }) => <RouteAsCell routeAs={`${row.original.provider}/${row.original.model}`} />,
  },
  {
    id: 'requests',
    header: 'Requests',
    meta: RIGHT,
    cell: ({ row }) => formatCount(row.original.requests),
  },
  {
    id: 'success',
    header: 'Success',
    meta: RIGHT,
    cell: ({ row }) => `${row.original.successPct.toFixed(1)}%`,
  },
  {
    id: 'latency',
    header: 'Avg latency',
    meta: RIGHT,
    cell: ({ row }) => (row.original.latencyMs > 0 ? formatLatency(row.original.latencyMs) : '—'),
  },
  {
    id: 'tokens',
    header: 'Tokens in / out',
    meta: { ...RIGHT, cellClassName: `${RIGHT.cellClassName} text-muted-foreground` },
    cell: ({ row }) =>
      `${formatCompact(row.original.inputTokens)} / ${formatCompact(row.original.outputTokens)}`,
  },
  {
    id: 'cost',
    header: 'Cost',
    meta: RIGHT,
    cell: ({ row }) =>
      row.original.costMicros === null ? (
        <span className="text-muted-foreground">Unpriced</span>
      ) : (
        formatMicrosUsd(row.original.costMicros)
      ),
  },
]
