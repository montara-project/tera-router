import { IconArrowRight, IconShieldCheck } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'

import type { HealthWindow } from '@/lib/api/models/provider-health'
import type { UsageRange } from '@/lib/api/models/usage'

import HealthTable from '@/components/block/provider-health/health-table'
import { Skeleton } from '@/components/ui/skeleton'
import { providerHealthQueries } from '@/lib/api/queries/provider-health'

// Provider health supports 5m–7d windows; the usage page's wider periods
// clamp onto the largest window they share.
const HEALTH_WINDOW_BY_RANGE: Record<UsageRange, HealthWindow> = {
  today: '24h',
  '24h': '24h',
  '7d': '7d',
  '30d': '7d',
}

/** The providers tab of the full provider-health dashboard, scoped to the
 * usage page's selected period. */
export default function UsageHealthStrip({ range }: { range: UsageRange }) {
  const window = HEALTH_WINDOW_BY_RANGE[range]

  const { data, isPending } = useQuery(providerHealthQueries.overview(window))

  return (
    <section className="space-y-2.5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <IconShieldCheck className="mt-0.5 h-4 w-4 text-muted-foreground" />
          <div>
            <p className="text-sm font-semibold text-foreground">Provider health</p>
            <p className="text-muted-foreground text-xs">Rolling {window} attempt telemetry.</p>
          </div>
        </div>

        <Link
          to="/provider-health"
          className="inline-flex items-center gap-1 text-xs font-medium text-emerald-500 transition-colors hover:text-emerald-400"
        >
          Open full health dashboard
          <IconArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {isPending ? (
        <Skeleton className="h-44 w-full rounded-xl" />
      ) : (
        <HealthTable
          entityLabel="Provider"
          entries={data?.providers ?? []}
          pageSize={10}
          onView={(name) => {
            // TODO: Navigate to provider detail page
            console.log('View provider:', name)
          }}
        />
      )}
    </section>
  )
}
