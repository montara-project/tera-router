import { IconGauge, IconRefresh } from '@tabler/icons-react'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useQueryState } from 'nuqs'
import { useEffect, useState } from 'react'

import type { QuotaFilters } from '@/components/block/quota/filter-quota'
import type { Models } from '@/lib/api/models'

import PageHeader from '@/components/block/common/page-header'
import SegmentedControl from '@/components/block/common/segmented-control'
import { DEFAULT_QUOTA_FILTERS } from '@/components/block/quota/filter-quota'
import QuotaAccountsCard from '@/components/block/quota/quota-accounts-card'
import QuotaStatStrip from '@/components/block/quota/quota-stat-strip'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useDebounce } from '@/hooks/use-debounce'
import { usePaginationQuery } from '@/hooks/use-pagination-query'
import { QUOTA_QUERY_KEY, quotaQueries } from '@/lib/api/queries/quota'

export const Route = createFileRoute('/(protected)/(analytics)/quota/')({
  component: RouteComponent,
})

const RANGES = [
  { value: 'today', label: 'Today' },
  { value: '24h', label: '24h' },
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
  { value: '90d', label: '90d' },
] as const satisfies readonly { value: Models.QuotaRange; label: string }[]

const AUTO_REFRESH_MS = 60_000

/** Stable empty list so the derived memos keep their identity while loading. */
const NO_ACCOUNTS: Models.QuotaAccount[] = []

function RouteComponent() {
  const queryClient = useQueryClient()
  const [range, setRange] = useState<Models.QuotaRange>('7d')
  const [filters, setFilters] = useState<QuotaFilters>(DEFAULT_QUOTA_FILTERS)
  const [now, setNow] = useState(() => Date.now())

  const { offset, limit, pageIndex } = usePaginationQuery()
  const search = useDebounce({ value: filters.search.trim(), delay: 300 })
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
  } = useQuery({
    // The server filters, sorts and pages; the page reads one page of matches.
    ...quotaQueries.list({
      offset,
      limit,
      range,
      search: search || undefined,
      provider: filters.provider === 'all' ? undefined : filters.provider,
      status: filters.status === 'all' ? undefined : filters.status,
      quota_state: filters.quotaState === 'all' ? undefined : filters.quotaState,
      sort: filters.sort,
    }),
    placeholderData: keepPreviousData,
  })

  // Ticks once a second so the auto-refresh countdown stays live.
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const overview = overviewData?.data
  const rows = accountsData?.data ?? NO_ACCOUNTS
  const total = accountsData?.metadata.total ?? 0

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
    // A new filter starts from the first page.
    setFilters((previous) => ({ ...previous, ...patch }))
    void setPageParam(null)
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        description="Upstream limits and local usage for each provider account."
        icon={IconGauge}
        title="Quota tracker"
        actions={
          <>
            <SegmentedControl
              aria-label="Time range"
              options={RANGES}
              value={range}
              onChange={handleRangeChange}
            />
            <span className="inline-flex h-8 items-center gap-2 rounded-md border border-border px-2.5 text-xs font-medium tabular-nums">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              Auto refresh · {secondsLeft}s
            </span>
            <Button
              aria-label="Refresh"
              disabled={refreshing}
              onClick={refresh}
              size="icon"
              variant="outline"
            >
              <IconRefresh className={refreshing ? 'animate-spin' : undefined} />
            </Button>
          </>
        }
      />

      {overview ? (
        <QuotaStatStrip summary={overview.summary} />
      ) : (
        <Skeleton className="h-25 rounded-lg" />
      )}

      <QuotaAccountsCard
        summary={overview?.summary}
        paged={rows}
        total={total}
        loading={accountsLoading}
        pageIndex={pageIndex}
        pageSize={limit}
        filters={filters}
        onChange={handleFilterChange}
      />
    </div>
  )
}
