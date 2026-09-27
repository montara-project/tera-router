import type { HealthEntry, HealthStatus } from '@/lib/api/models/provider-health'

import { Card, CardContent } from '@/components/ui/card'

interface HealthSummaryCardProps {
  providers: HealthEntry[]
  fallbacks: number
  avgP95Ms: number
}

const SEGMENTS: {
  status: HealthStatus
  label: string
  barClass: string
  dotClass: string
}[] = [
  { status: 'healthy', label: 'Healthy', barClass: 'bg-emerald-500', dotClass: 'bg-emerald-500' },
  { status: 'degraded', label: 'Degraded', barClass: 'bg-amber-500', dotClass: 'bg-amber-500' },
  { status: 'down', label: 'Down', barClass: 'bg-red-500', dotClass: 'bg-red-500' },
]

export default function HealthSummaryCard({
  providers,
  fallbacks,
  avgP95Ms,
}: HealthSummaryCardProps) {
  const total = providers.length

  return (
    <Card className="bg-background">
      <CardContent className="flex flex-col gap-6 lg:flex-row lg:items-center">
        <div className="min-w-0 flex-1 space-y-3">
          <p className="text-muted-foreground text-xs font-semibold uppercase tracking-[0.14em]">
            Provider Health
          </p>

          <div className="flex items-center gap-3">
            <div
              className="flex h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted"
              role="img"
              aria-label={`Provider health: ${SEGMENTS.map(
                (segment) =>
                  `${providers.filter((p) => p.status === segment.status).length} ${segment.label}`
              ).join(', ')}`}
            >
              {SEGMENTS.map((segment) => {
                const count = providers.filter((p) => p.status === segment.status).length
                if (count === 0) return null

                return (
                  <div
                    key={segment.status}
                    className={segment.barClass}
                    title={`${count} ${segment.label}`}
                    style={{ width: `${(count / total) * 100}%` }}
                  />
                )
              })}
            </div>
            <span className="shrink-0 text-sm font-semibold text-foreground">{total} total</span>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {SEGMENTS.map((segment) => {
              const count = providers.filter((p) => p.status === segment.status).length

              return (
                <span key={segment.status} className="inline-flex items-center gap-1.5 text-xs">
                  <span className={`size-1.5 rounded-full ${segment.dotClass}`} />
                  <span className="font-semibold tabular-nums text-foreground">{count}</span>
                  <span className="text-muted-foreground">{segment.label}</span>
                </span>
              )
            })}
          </div>

          <p className="text-muted-foreground text-xs">
            Share of providers by current health status. Green is working normally; yellow is slower
            or less reliable; red should be avoided.
          </p>
        </div>

        <div className="flex shrink-0 gap-10 lg:border-l lg:border-border lg:pl-10">
          <div>
            <p className="text-muted-foreground text-xs font-semibold uppercase tracking-[0.14em]">
              Fallbacks
            </p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{fallbacks}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs font-semibold uppercase tracking-[0.14em]">
              Avg P95
            </p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{avgP95Ms}ms</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
