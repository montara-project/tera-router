import { useQuery } from '@tanstack/react-query'

import type { UsageRange } from '@/lib/api/models/usage'

import UsageTrendCard from '@/components/block/cost-analytics/usage/usage-trend-card'
import OverviewProviderMix from '@/components/block/dashboard/overview-provider-mix'
import OverviewRecentRequests from '@/components/block/dashboard/overview-recent-requests'
import OverviewStatCards from '@/components/block/dashboard/overview-stat-cards'
import OverviewTokenComposition from '@/components/block/dashboard/overview-token-composition'
import OverviewUsageActivity from '@/components/block/dashboard/overview-usage-activity'
import { Skeleton } from '@/components/ui/skeleton'
import { usageQueries } from '@/lib/api/queries/usage'

function OverviewSkeleton() {
  return (
    <div className="space-y-4 pb-12">
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
      </div>
      <div className="grid gap-4 xl:grid-cols-5">
        <Skeleton className="h-80 rounded-xl xl:col-span-3" />
        <Skeleton className="h-96 rounded-xl xl:col-span-2" />
      </div>
      <Skeleton className="h-32 rounded-xl" />
      <Skeleton className="h-64 rounded-xl" />
      <Skeleton className="h-96 rounded-xl" />
    </div>
  )
}

export default function UsageOverviewSection({ range }: { range: UsageRange }) {
  const { data } = useQuery(usageQueries.telemetry(range))

  if (!data) {
    return <OverviewSkeleton />
  }

  return (
    <div className="space-y-4 pb-12">
      <OverviewStatCards telemetry={data} />

      <div className="grid gap-4 xl:grid-cols-5">
        <div className="xl:col-span-3">
          <UsageTrendCard telemetry={data} />
        </div>
        <div className="xl:col-span-2">
          <OverviewProviderMix rows={data.providerAccounting} />
        </div>
      </div>

      <OverviewTokenComposition telemetry={data} />

      <OverviewUsageActivity />

      <OverviewRecentRequests rows={data.recentRequests} />
    </div>
  )
}
