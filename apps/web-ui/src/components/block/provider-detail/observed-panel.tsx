import type { ColumnDef } from '@tanstack/react-table'

import { IconActivity, IconSearch } from '@tabler/icons-react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
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
import { useDebounce } from '@/hooks/use-debounce'
import { usePaginationQuery } from '@/hooks/use-pagination-query'
import { queries } from '@/lib/api/queries'
import { formatMicrosUsd } from '@/lib/currency'
import { formatCompact, formatCount, formatLatency } from '@/lib/format'

/** The pager never offers fewer than 10 rows. */
const PAGE_SIZES = [10, 25, 50, 100]

/** Models this provider actually served in the last 30 days, from usage accounting. */
export default function ObservedPanel({
  providerSlug,
  observedCount,
}: {
  providerSlug: string
  /** models the provider served in the window, before any search */
  observedCount: number
}) {
  const [search, setSearchValue] = useState('')
  // The server scopes the rows to the provider, searches and pages them; the
  // pager keeps its page in ?page.
  const { offset, limit, pageIndex } = usePaginationQuery()
  const [, setPageParam] = useQueryState('page')
  // A new search starts from the first page.
  const setSearch = (value: string) => {
    setSearchValue(value)
    void setPageParam(null)
  }
  const q = useDebounce({ value: search.trim(), delay: 300 })
  const query = useQuery({
    ...queries.usage.models({
      range: '30d',
      provider: providerSlug,
      search: q || undefined,
      offset,
      limit,
    }),
    enabled: providerSlug !== '',
    placeholderData: keepPreviousData,
  })
  const rows = query.data?.data ?? []
  const total = query.data?.metadata.total ?? 0
  const loading = query.isLoading

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

    if (observedCount === 0 && q === '') {
      return (
        <EmptyState
          className="border-0"
          icon={IconActivity}
          title="No observed models yet"
          description="Models appear here after this provider serves traffic. The Catalog tab lists every model the provider exposes."
        />
      )
    }

    if (total === 0) {
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
        total={total}
        data={rows}
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
      {observedCount > 0 && (
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
            {q ? `${total} of ${observedCount} shown` : `${observedCount} shown`}
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
