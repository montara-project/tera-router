import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { RefreshCw } from 'lucide-react'
import { useQueryState } from 'nuqs'
import { useEffect, useMemo, useState } from 'react'

import type { Models } from '@/lib/api/models'

import ReactTable from '@/components/block/common/react-table'
import SectionCard from '@/components/block/common/section-card'
import SimpleButtonGroup, {
  type SimpleButtonGroupItem,
} from '@/components/block/common/simple-button-group'
import { QuotaAccountColumn } from '@/components/block/quota/column'
import FilterQuota, {
  applyQuotaFilters,
  DEFAULT_QUOTA_FILTERS,
  type QuotaFilters,
} from '@/components/block/quota/filter-quota'
import QuotaSummarySection from '@/components/block/quota/quota-summary-section'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { usePaginationQuery } from '@/hooks/use-pagination-query'
import { QUOTA_QUERY_KEY, quotaQueries } from '@/lib/api/queries/quota'

export const Route = createFileRoute('/(protected)/(analytics)/quota/')({
  component: RouteComponent,
})

const RANGE_ITEMS: SimpleButtonGroupItem[] = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: '7D' },
  { value: '30d', label: '30D' },
]

const AUTO_REFRESH_MS = 60_000

function RouteSkeleton() {
  return (
    <div className="bg-sidebar border border-sidebar-accent p-2 rounded-2xl">
      <div className="space-y-4 rounded-lg border border-border bg-background p-4">
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-44 rounded-lg" />
          <Skeleton className="h-44 rounded-lg" />
          <Skeleton className="h-44 rounded-lg" />
        </div>
        <Skeleton className="h-96 w-full rounded-lg" />
      </div>
    </div>
  )
}

function RouteComponent() {
  const queryClient = useQueryClient()
  const [range, setRange] = useState<Models.QuotaRange>('30d')
  const [filters, setFilters] = useState<QuotaFilters>(DEFAULT_QUOTA_FILTERS)
  const [now, setNow] = useState(() => Date.now())

  const { offset, limit, pageIndex } = usePaginationQuery()
  // The pager writes ?page=<n> directly; clearing it returns to page 1.
  const [, setPageParam] = useQueryState('page')

  const {
    data: overviewData,
    isFetching: overviewFetching,
    isLoading: overviewLoading,
    dataUpdatedAt: overviewUpdatedAt,
  } = useQuery(quotaQueries.overview(range))
  const {
    data: accountsData,
    isFetching: accountsFetching,
    isLoading: accountsLoading,
    dataUpdatedAt: accountsUpdatedAt,
  } = useQuery(quotaQueries.list({ offset, limit, range }))

  // Ticks once a second so the auto-refresh countdown stays live.
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const overview = overviewData?.data
  const loading = accountsFetching || accountsLoading

  const accounts = useMemo(
    () => applyQuotaFilters(accountsData?.data ?? [], filters),
    [accountsData, filters]
  )

  // The API returns every account regardless of offset/limit, so page the
  // filtered set client-side.
  const pagedAccounts = useMemo(
    () => accounts.slice(offset, offset + limit),
    [accounts, offset, limit]
  )
  const total = accounts.length

  const columns = QuotaAccountColumn({ loading })

  const providerOptions = useMemo(() => {
    const names = Array.from(
      new Set((accountsData?.data ?? []).map((account) => account.provider))
    ).sort()

    return [
      { value: 'all', label: 'All providers' },
      ...names.map((name) => ({ value: name, label: name })),
    ]
  }, [accountsData])

  if (!overview) {
    return <RouteSkeleton />
  }

  const refreshing = (overviewFetching || accountsFetching) && !(overviewLoading && accountsLoading)

  // Counted from the last successful fetch so the badge resets on both the
  // interval and manual refreshes.
  const lastRefreshAt = Math.max(overviewUpdatedAt, accountsUpdatedAt)
  const secondsLeft = lastRefreshAt
    ? Math.max(0, Math.round((AUTO_REFRESH_MS - (now - lastRefreshAt)) / 1000))
    : AUTO_REFRESH_MS / 1000

  const refresh = () => queryClient.invalidateQueries({ queryKey: [QUOTA_QUERY_KEY] })

  const handleRangeChange = (value: string) => setRange(value as Models.QuotaRange)

  const handleFilterChange = (patch: Partial<QuotaFilters>) => {
    // Filters re-page the client-side set, so drop a stale page index.
    setFilters((previous) => ({ ...previous, ...patch }))
    void setPageParam(null)
  }

  return (
    <SectionCard
      title="Quota Tracker"
      description="Monitor account capacity, reported upstream limits, and period usage."
      toolbar={
        <div className="flex items-center gap-2.5">
          <span className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-emerald-600 tabular-nums dark:text-emerald-400">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            Auto refresh · {secondsLeft}s
          </span>
          <SimpleButtonGroup
            defaultValue={range}
            items={RANGE_ITEMS}
            onValueChange={handleRangeChange}
          />
          <Button
            aria-label="Refresh"
            disabled={refreshing}
            onClick={refresh}
            radius="full"
            size="icon"
            variant="outline"
          >
            <RefreshCw className={refreshing ? 'animate-spin' : undefined} />
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <QuotaSummarySection summary={overview.summary} />

        <FilterQuota
          count={accounts.length}
          filters={filters}
          onChange={handleFilterChange}
          providerOptions={providerOptions}
        />

        <ReactTable
          total={total}
          data={pagedAccounts}
          pageIndex={pageIndex}
          pageSize={limit}
          columns={columns}
        />
      </div>
    </SectionCard>
  )
}
