import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { RefreshCw } from 'lucide-react'
import { useMemo, useState } from 'react'

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
import { getTotal } from '@/lib/constants/paginate'

export const Route = createFileRoute('/(protected)/(analytics)/quota/')({
  component: RouteComponent,
})

const RANGE_ITEMS: SimpleButtonGroupItem[] = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: '7D' },
  { value: '30d', label: '30D' },
]

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

  const { offset, limit, pageIndex } = usePaginationQuery()

  const {
    data: overviewData,
    isFetching: overviewFetching,
    isLoading: overviewLoading,
  } = useQuery(quotaQueries.overview(range))
  const {
    data: accountsData,
    isFetching: accountsFetching,
    isLoading: accountsLoading,
  } = useQuery(quotaQueries.list({ offset, limit }))

  const overview = overviewData?.data
  const loading = accountsFetching || accountsLoading
  const total = getTotal(accountsData)

  const columns = QuotaAccountColumn({ loading })

  const accounts = useMemo(
    () => applyQuotaFilters(accountsData?.data ?? [], filters),
    [accountsData, filters]
  )

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

  const refresh = () => queryClient.invalidateQueries({ queryKey: [QUOTA_QUERY_KEY] })

  const handleRangeChange = (value: string) => setRange(value as Models.QuotaRange)

  const handleFilterChange = (patch: Partial<QuotaFilters>) =>
    setFilters((previous) => ({ ...previous, ...patch }))

  return (
    <SectionCard
      title="Quota Tracker"
      description="Monitor account capacity, reported upstream limits, and period usage."
      toolbar={
        <div className="flex items-center gap-2.5">
          <span className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            Auto refresh · 5s
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
          data={accounts}
          pageIndex={pageIndex}
          pageSize={limit}
          columns={columns}
        />
      </div>
    </SectionCard>
  )
}
