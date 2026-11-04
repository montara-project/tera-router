import { useQuery } from '@tanstack/react-query'

import type { UsageRange } from '@/lib/api/models/usage'

import OverviewTrafficChart from '@/components/block/dashboard/overview-traffic-chart'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { usageQueries } from '@/lib/api/queries/usage'

import UsageDistributionPanel from './usage-distribution-panel'
import UsageModelAccounting from './usage-model-accounting'
import UsageOptimizationPanel from './usage-optimization-panel'
import UsageProviderAccounting from './usage-provider-accounting'
import UsageRecentRequests from './usage-recent-requests'
import UsageStatCards from './usage-stat-cards'

const TAB_CLASS =
  'gap-1.5 px-3 text-[13px] data-[state=active]:border-primary! data-[state=active]:text-foreground!'

function UsageSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-25 rounded-lg" />
      <Skeleton className="h-10 rounded-lg" />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Skeleton className="h-92 rounded-lg" />
        <Skeleton className="h-92 rounded-lg" />
      </div>
    </div>
  )
}

/** Count chip next to a tab label. */
function Count({ value }: { value: number }) {
  return (
    <span className="bg-muted text-foreground/75 rounded-sm px-1.5 text-[11.5px] tabular-nums">
      {value}
    </span>
  )
}

export default function UsageSection({ range }: { range: UsageRange }) {
  const { data } = useQuery(usageQueries.telemetry(range))

  if (!data) {
    return <UsageSkeleton />
  }

  return (
    <div className="flex flex-col gap-6">
      <UsageStatCards telemetry={data} />

      <Tabs defaultValue="overview" className="gap-6">
        <TabsList
          variant="line"
          size="md"
          className="w-full justify-start gap-1 border-b border-border"
        >
          <TabsTrigger value="overview" className={TAB_CLASS}>
            Overview
          </TabsTrigger>
          <TabsTrigger value="providers" className={TAB_CLASS}>
            Providers <Count value={data.providerAccounting.length} />
          </TabsTrigger>
          <TabsTrigger value="models" className={TAB_CLASS}>
            Models <Count value={data.modelAccounting.length} />
          </TabsTrigger>
          <TabsTrigger value="requests" className={TAB_CLASS}>
            Requests <Count value={data.recentRequests.length} />
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="flex flex-col gap-6">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <OverviewTrafficChart telemetry={data} />
            <UsageDistributionPanel telemetry={data} />
          </div>
          <UsageOptimizationPanel telemetry={data} range={range} />
        </TabsContent>
        <TabsContent value="providers">
          <UsageProviderAccounting rows={data.providerAccounting} />
        </TabsContent>
        <TabsContent value="models">
          <UsageModelAccounting rows={data.modelAccounting} />
        </TabsContent>
        <TabsContent value="requests">
          <UsageRecentRequests rows={data.recentRequests} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
