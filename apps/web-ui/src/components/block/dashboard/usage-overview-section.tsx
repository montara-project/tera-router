import { useQuery } from '@tanstack/react-query'

import type { UsageRange } from '@/lib/api/models/usage'

import OverviewProviderHealth from '@/components/block/dashboard/overview-provider-health'
import OverviewRecentRequests from '@/components/block/dashboard/overview-recent-requests'
import OverviewRoutingChains from '@/components/block/dashboard/overview-routing-chains'
import OverviewSavingsBudgets from '@/components/block/dashboard/overview-savings-budgets'
import OverviewStatCards from '@/components/block/dashboard/overview-stat-cards'
import OverviewTokenComposition from '@/components/block/dashboard/overview-token-composition'
import OverviewTopModels from '@/components/block/dashboard/overview-top-models'
import OverviewTrafficChart from '@/components/block/dashboard/overview-traffic-chart'
import OverviewUsageActivity from '@/components/block/dashboard/overview-usage-activity'
import { Skeleton } from '@/components/ui/skeleton'
import { usageQueries } from '@/lib/api/queries/usage'

/** Main column and side column of the two-panel rows. */
const ROW = 'grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]'

function OverviewSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-25 rounded-lg" />
      {/* Traffic chart and provider health: the health card is sized to five providers. */}
      <div className={ROW}>
        <Skeleton className="h-117 rounded-lg" />
        <Skeleton className="h-117 rounded-lg" />
      </div>
      <Skeleton className="h-84 rounded-lg" />
    </div>
  )
}

export default function UsageOverviewSection({ range }: { range: UsageRange }) {
  const { data } = useQuery(usageQueries.telemetry(range))

  if (!data) {
    return <OverviewSkeleton />
  }

  return (
    <div className="flex flex-col gap-6">
      <OverviewStatCards telemetry={data} />

      <div className={ROW}>
        <OverviewTrafficChart telemetry={data} />
        <OverviewProviderHealth range={range} />
      </div>

      <OverviewUsageActivity />

      <OverviewTokenComposition telemetry={data} />

      <div className={ROW}>
        <OverviewTopModels telemetry={data} />
        <OverviewSavingsBudgets telemetry={data} />
      </div>

      <div className={ROW}>
        <OverviewRecentRequests rows={data.recentRequests} />
        <OverviewRoutingChains />
      </div>
    </div>
  )
}
