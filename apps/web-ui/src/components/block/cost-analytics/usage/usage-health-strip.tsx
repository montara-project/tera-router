import { IconArrowRight, IconInbox, IconShieldCheck } from '@tabler/icons-react'
import { Link } from '@tanstack/react-router'

import { Card, CardContent } from '@/components/ui/card'

// TODO: wire the counters to the 15m provider-health rollup
// (`/v1/provider-health`) once it exists; zeros render the empty state
// exactly like the reference.
const STRIP = {
  healthy: 0,
  degraded: 0,
  unhealthy: 0,
  unknown: 0,
  fallbacks: 0,
}

const STATS = [
  { key: 'healthy', label: 'Healthy', value: STRIP.healthy, valueClass: 'text-emerald-500' },
  { key: 'degraded', label: 'Degraded', value: STRIP.degraded, valueClass: 'text-amber-500' },
  { key: 'unhealthy', label: 'Unhealthy', value: STRIP.unhealthy, valueClass: 'text-red-500' },
  { key: 'unknown', label: 'Unknown', value: STRIP.unknown, valueClass: 'text-foreground' },
  { key: 'fallbacks', label: 'Fallbacks', value: STRIP.fallbacks, valueClass: 'text-foreground' },
  { key: 'avgP95', label: 'Avg P95', value: '—', valueClass: 'text-foreground' },
] as const

export default function UsageHealthStrip() {
  const hasData = Object.values(STRIP).some((value) => value > 0)

  return (
    <Card className="bg-background">
      <CardContent className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <IconShieldCheck className="mt-0.5 h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-semibold text-foreground">Provider health</p>
              <p className="text-muted-foreground text-xs">Rolling 15m attempt telemetry.</p>
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

        <div className="mt-5 grid grid-cols-3 gap-x-4 gap-y-4 border-t border-border/60 pt-4 sm:grid-cols-6">
          {STATS.map((stat) => (
            <div key={stat.key}>
              <p className="text-muted-foreground text-[10px] font-semibold uppercase tracking-[0.14em]">
                {stat.label}
              </p>
              <p className={`mt-1 text-xl font-semibold ${stat.valueClass}`}>{stat.value}</p>
            </div>
          ))}
        </div>

        {!hasData ? (
          <div className="mt-6 flex flex-col items-center gap-3 border-t border-border/60 py-10 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <IconInbox className="h-5 w-5 text-muted-foreground" />
            </span>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">No provider health data yet.</p>
              <p className="text-muted-foreground text-sm">
                Send traffic or run a provider probe to populate telemetry.
              </p>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
