import { useQuery } from '@tanstack/react-query'

import type { UsageRange } from '@/lib/api/models/usage'

import { Skeleton } from '@/components/ui/skeleton'
import { usageQueries } from '@/lib/api/queries/usage'

import { ModelAccountingTable, ProviderAccountingTable } from './usage-accounting-tables'
import { OptimizationBar, QualityBar } from './usage-bars'
import UsageDistributionCard from './usage-distribution-card'
import UsageHealthStrip from './usage-health-strip'
import UsageOverviewCards from './usage-overview-cards'
import UsageRecentRequests from './usage-recent-requests'
import UsageTrendCard from './usage-trend-card'

function UsageSkeleton() {
  return (
    <div className="space-y-4 pb-12">
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
      </div>
      <Skeleton className="h-16 rounded-xl" />
      <div className="grid gap-4 xl:grid-cols-5">
        <Skeleton className="h-80 rounded-xl xl:col-span-3" />
        <Skeleton className="h-80 rounded-xl xl:col-span-2" />
      </div>
      <Skeleton className="h-16 rounded-xl" />
      <Skeleton className="h-72 rounded-xl" />
    </div>
  )
}

export default function UsageSection({ range }: { range: UsageRange }) {
  const { data } = useQuery(usageQueries.telemetry(range))

  if (!data) {
    return <UsageSkeleton />
  }

  return (
    <div className="space-y-4 pb-12">
      <UsageOverviewCards telemetry={data} />

      <QualityBar quality={data.quality} />

      <div className="grid gap-4 xl:grid-cols-5">
        <div className="xl:col-span-3">
          <UsageTrendCard telemetry={data} />
        </div>
        <div className="xl:col-span-2">
          <UsageDistributionCard telemetry={data} />
        </div>
      </div>

      <OptimizationBar optimization={data.optimization} />

      <UsageHealthStrip range={range} />

      <ProviderAccountingTable rows={data.providerAccounting} />

      <ModelAccountingTable rows={data.modelAccounting} />

      <UsageRecentRequests rows={data.recentRequests} />
    </div>
  )
}
