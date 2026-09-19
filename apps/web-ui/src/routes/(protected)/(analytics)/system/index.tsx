import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { Cpu, MemoryStick, RefreshCw } from 'lucide-react'

import SectionCard from '@/components/block/common/section-card'
import CpuPerCoreCard from '@/components/block/system/cpu-per-core-card'
import GoRuntimeCard from '@/components/block/system/go-runtime-card'
import HostInfoCard from '@/components/block/system/host-info-card'
import SystemMetricChartCard from '@/components/block/system/system-metric-chart-card'
import SystemOverviewCard from '@/components/block/system/system-overview-card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { SYSTEM_QUERY_KEY, systemQueries } from '@/lib/api/queries/system'

export const Route = createFileRoute('/(protected)/(analytics)/system/')({
  component: RouteComponent,
})

const LOAD_THRESHOLD = 80

const CHART_COLORS = {
  hostCpu: '#10b981',
  hostMemory: '#f97316',
  processCpu: '#f59e0b',
  processRss: '#06b6d4',
} as const

function RouteSkeleton() {
  return (
    <div className="bg-sidebar border border-sidebar-accent p-2 rounded-2xl">
      <div className="space-y-4 rounded-lg border border-border bg-background p-4">
        <Skeleton className="h-64 w-full rounded-lg" />
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-72 rounded-lg" />
          <Skeleton className="h-72 rounded-lg" />
          <Skeleton className="h-72 rounded-lg" />
          <Skeleton className="h-72 rounded-lg" />
        </div>
        <Skeleton className="h-40 w-full rounded-lg" />
      </div>
    </div>
  )
}

function RouteComponent() {
  const queryClient = useQueryClient()
  const { data, isFetching } = useQuery(systemQueries.stats())
  const stats = data?.data

  if (!stats) {
    return <RouteSkeleton />
  }

  const refresh = () => queryClient.invalidateQueries({ queryKey: [SYSTEM_QUERY_KEY] })

  return (
    <SectionCard
      title="System Monitor"
      description="Real-time resource usage and runtime health"
      toolbar={
        <Button disabled={isFetching} onClick={refresh} radius="full" variant="outline">
          <RefreshCw className={isFetching ? 'animate-spin' : undefined} />
          Refresh
        </Button>
      }
    >
      <div className="space-y-4">
        <SystemOverviewCard stats={stats} />

        <div className="grid gap-4 lg:grid-cols-2">
          <SystemMetricChartCard
            color={CHART_COLORS.hostCpu}
            description="System-wide CPU percentage over time"
            icon={Cpu}
            max={100}
            min={0}
            points={stats.history.hostCpu}
            threshold={LOAD_THRESHOLD}
            title="Host CPU"
            tone="emerald"
          />
          <SystemMetricChartCard
            color={CHART_COLORS.hostMemory}
            description="System-wide memory percentage over time"
            icon={MemoryStick}
            max={100}
            min={0}
            points={stats.history.hostMemory}
            threshold={LOAD_THRESHOLD}
            title="Host Memory"
            tone="orange"
          />
          <SystemMetricChartCard
            color={CHART_COLORS.processCpu}
            description="keirouter's own CPU usage over time"
            icon={Cpu}
            max={100}
            min={0}
            points={stats.history.processCpu}
            threshold={LOAD_THRESHOLD}
            title="Process CPU"
            tone="amber"
          />
          <SystemMetricChartCard
            color={CHART_COLORS.processRss}
            description="keirouter's resident memory over time"
            icon={MemoryStick}
            points={stats.history.processRss}
            title="Process RSS"
            tone="cyan"
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <GoRuntimeCard process={stats.process} runtime={stats.runtime} />
          <HostInfoCard host={stats.host} process={stats.process} />
        </div>

        <CpuPerCoreCard cores={stats.cores} />
      </div>
    </SectionCard>
  )
}
