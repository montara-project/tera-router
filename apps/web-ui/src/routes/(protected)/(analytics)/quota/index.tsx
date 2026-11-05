import { IconGauge, IconRefresh } from '@tabler/icons-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useQueryState } from 'nuqs'
import { useEffect, useMemo, useState } from 'react'

import type { QuotaFilters } from '@/components/block/quota/filter-quota'
import type { Models } from '@/lib/api/models'

import PageHeader from '@/components/block/common/page-header'
import SegmentedControl from '@/components/block/common/segmented-control'
import { applyQuotaFilters, DEFAULT_QUOTA_FILTERS } from '@/components/block/quota/filter-quota'
import QuotaAccountsCard from '@/components/block/quota/quota-accounts-card'
import QuotaStatStrip, { TEAL_CHIP } from '@/components/block/quota/quota-stat-strip'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
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
  const listData = accountsData?.data ?? NO_ACCOUNTS

  const accounts = useMemo(() => applyQuotaFilters(listData, filters), [listData, filters])

  // The API returns every account regardless of offset/limit, so page the
  // filtered set client-side.
  const pagedAccounts = useMemo(
    () => accounts.slice(offset, offset + limit),
    [accounts, offset, limit]
  )
  const total = accounts.length

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
    <div className="flex flex-col gap-6">
      <PageHeader
        description="Upstream limits and local usage for each provider account."
        icon={IconGauge}
        iconClassName={TEAL_CHIP}
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
        <QuotaStatStrip summary={overview.summary} accounts={listData} />
      ) : (
        <Skeleton className="h-25 rounded-lg" />
      )}

      <QuotaAccountsCard
        accounts={listData}
        paged={pagedAccounts}
        total={total}
        loading={accountsLoading && listData.length === 0}
        pageIndex={pageIndex}
        pageSize={limit}
        onPageChange={(page) => void setPageParam(page === 0 ? null : String(page))}
        filters={filters}
        onChange={handleFilterChange}
      />
    </div>
  )
}
