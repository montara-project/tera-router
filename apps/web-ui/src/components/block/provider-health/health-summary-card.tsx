import type { HealthEntry } from '@/lib/api/models/provider-health'

import { Card, CardContent } from '@/components/ui/card'

interface HealthSummaryCardProps {
  providers: HealthEntry[]
  fallbacks: number
  avgP95Ms: number
}

const SEGMENTS = [
  { status: 'healthy', barClass: 'bg-emerald-500' },
  { status: 'degraded', barClass: 'bg-amber-500' },
  { status: 'down', barClass: 'bg-red-500' },
] as const

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
            <div className="flex h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
              {SEGMENTS.map((segment) => {
                const count = providers.filter((p) => p.status === segment.status).length
                if (count === 0) return null

                return (
                  <div
                    key={segment.status}
                    className={segment.barClass}
                    style={{ width: `${(count / total) * 100}%` }}
                  />
                )
              })}
            </div>
            <span className="shrink-0 text-sm font-semibold text-foreground">{total} total</span>
          </div>

          <p className="text-muted-foreground text-xs">
            Share of providers by current health status. Green is working normally; yellow is
            slower or less reliable; red should be avoided.
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
