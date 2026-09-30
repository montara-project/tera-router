import { IconRefresh } from '@tabler/icons-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'

import type { HealthWindow } from '@/lib/api/models/provider-health'

import SectionCard from '@/components/block/common/section-card'
import HealthSummaryCard from '@/components/block/provider-health/health-summary-card'
import HealthTable from '@/components/block/provider-health/health-table'
import ProbesTable from '@/components/block/provider-health/probes-table'
import ProviderHealthTabs, {
  type HealthTab,
} from '@/components/block/provider-health/provider-health-tabs'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { PROVIDER_HEALTH_QUERY_KEY, providerHealthQueries } from '@/lib/api/queries/provider-health'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/(protected)/(safety)/provider-health/')({
  component: RouteComponent,
})

const TIME_RANGES = ['5m', '15m', '1h', '6h', '24h', '7d'] as const

function RouteSkeleton() {
  return (
    <div className="bg-sidebar border border-sidebar-accent p-2 rounded-2xl">
      <div className="rounded-lg border border-border bg-background p-4">
        <div className="space-y-2">
          <Skeleton className="h-6 w-44 rounded-lg" />
          <Skeleton className="h-4 w-[28rem] rounded-lg" />
        </div>

        <Skeleton className="mt-4 h-[104px] w-full rounded-xl" />

        <Skeleton className="mt-4 h-10 w-72 rounded-lg" />

        <Skeleton className="mt-4 h-14 w-full rounded-xl" />
        <Skeleton className="mt-2 h-14 w-full rounded-xl" />
        <Skeleton className="mt-2 h-14 w-full rounded-xl" />
      </div>
    </div>
  )
}

function ProviderHealthContent() {
  const queryClient = useQueryClient()
  const [range, setRange] = useState<HealthWindow>('7d')
  const [tab, setTab] = useState<HealthTab>('chains')

  const { data, isFetching } = useQuery(providerHealthQueries.overview(range))

  if (!data) {
    return <RouteSkeleton />
  }

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: [PROVIDER_HEALTH_QUERY_KEY] })
    toast.success('Health data refreshed')
  }

  const handleView = (name: string) => {
    toast.info(`Drill-down for ${name} is not wired to the backend yet`)
  }

  return (
    <SectionCard
      title="Provider Health"
      description="Monitor the health of every AI provider connected to Tera Router. See which are failing or slow, why, which routing chains are affected, and what to do next."
      toolbar={
        <>
          <div className="inline-flex items-center gap-1 rounded-lg border border-border bg-background p-1">
            {TIME_RANGES.map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={range === option}
                onClick={() => setRange(option)}
                className={cn(
                  'cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                  range === option
                    ? 'bg-accent text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {option}
              </button>
            ))}
          </div>
          <Button variant="outline" disabled={isFetching} onClick={handleRefresh}>
            <IconRefresh className={cn(isFetching && 'animate-spin')} />
            <span>Refresh</span>
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <HealthSummaryCard
          providers={data.providers}
          fallbacks={data.fallbacks}
          avgP95Ms={data.avgP95Ms}
        />

        <ProviderHealthTabs value={tab} onChange={setTab} />

        {tab === 'probes' ? (
          <ProbesTable entries={data.probes} />
        ) : (
          <HealthTable
            entityLabel={tab === 'chains' ? 'Chain' : tab === 'models' ? 'Model' : 'Provider'}
            entries={data[tab]}
            onView={handleView}
          />
        )}
      </div>
    </SectionCard>
  )
}

function RouteComponent() {
  return <ProviderHealthContent />
}
