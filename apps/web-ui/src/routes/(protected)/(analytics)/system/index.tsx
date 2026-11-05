import { IconCpu, IconDeviceSdCard, IconRefresh, IconServer } from '@tabler/icons-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'

import PageHeader from '@/components/block/common/page-header'
import CpuPerCoreCard from '@/components/block/system/cpu-per-core-card'
import GoRuntimeCard from '@/components/block/system/go-runtime-card'
import HostInfoCard from '@/components/block/system/host-info-card'
import SystemMetricChartCard from '@/components/block/system/system-metric-chart-card'
import SystemOverviewCard from '@/components/block/system/system-overview-card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { SYSTEM_QUERY_KEY, systemQueries } from '@/lib/api/queries/system'
import { formatMb } from '@/lib/format'

export const Route = createFileRoute('/(protected)/(analytics)/system/')({
  component: RouteComponent,
})

const LOAD_THRESHOLD = 80

// Design system accents: accent link, violet, teal, success.
const CHART_COLORS = {
  host_cpu: '#4091f3',
  host_memory: '#a78bfa',
  process_cpu: '#2fc4b2',
  process_rss: '#3fb872',
} as const

const percent = (value: number) => `${value.toFixed(1)}%`

function RouteComponent() {
  const queryClient = useQueryClient()
  const { data, isFetching } = useQuery(systemQueries.stats())
  const stats = data?.data

  const refresh = () => queryClient.invalidateQueries({ queryKey: [SYSTEM_QUERY_KEY] })

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={IconServer}
        title="System monitor"
        description="Real-time resource usage and runtime health."
        actions={
          <Button disabled={isFetching} onClick={refresh} variant="outline">
            <IconRefresh className={isFetching ? 'motion-safe:animate-spin' : undefined} />
            Refresh
          </Button>
        }
      />

      {stats ? (
        <>
          <SystemOverviewCard stats={stats} />

          <div className="grid gap-4 lg:grid-cols-2">
            <SystemMetricChartCard
              color={CHART_COLORS.host_cpu}
              description="System-wide CPU over time"
              format={percent}
              icon={IconCpu}
              max={100}
              min={0}
              points={stats.history.host_cpu}
              threshold={LOAD_THRESHOLD}
              title="Host CPU"
            />
            <SystemMetricChartCard
              color={CHART_COLORS.host_memory}
              description="System-wide memory over time"
              format={percent}
              icon={IconDeviceSdCard}
              max={100}
              min={0}
              points={stats.history.host_memory}
              threshold={LOAD_THRESHOLD}
              title="Host memory"
            />
            <SystemMetricChartCard
              color={CHART_COLORS.process_cpu}
              description="Tera Router's own CPU over time"
              format={percent}
              icon={IconCpu}
              max={100}
              min={0}
              points={stats.history.process_cpu}
              threshold={LOAD_THRESHOLD}
              title="Process CPU"
            />
            <SystemMetricChartCard
              color={CHART_COLORS.process_rss}
              description="Tera Router's resident memory over time"
              format={formatMb}
              icon={IconDeviceSdCard}
              points={stats.history.process_rss}
              title="Process RSS"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <GoRuntimeCard process={stats.process} runtime={stats.runtime} />
            <HostInfoCard host={stats.host} process={stats.process} />
          </div>

          <CpuPerCoreCard cores={stats.cores} />
        </>
      ) : (
        <>
          <Skeleton className="h-72 rounded-lg" />
          <div className="grid gap-4 lg:grid-cols-2">
            <Skeleton className="h-72 rounded-lg" />
            <Skeleton className="h-72 rounded-lg" />
            <Skeleton className="h-72 rounded-lg" />
            <Skeleton className="h-72 rounded-lg" />
          </div>
        </>
      )}
    </div>
  )
}
