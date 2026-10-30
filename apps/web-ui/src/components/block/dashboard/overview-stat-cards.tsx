import { IconActivity, IconCurrencyDollar, IconShieldCheck } from '@tabler/icons-react'

import type { UsageTelemetryOverview } from '@/lib/api/models/usage'

import { Card, CardContent } from '@/components/ui/card'
import { formatMicrosUsd } from '@/lib/currency'
import { formatCompact, formatLatency } from '@/lib/format'

interface OverviewStatCardsProps {
  telemetry: UsageTelemetryOverview
}

function StatCard({
  icon: Icon,
  label,
  tileClass,
  big,
  bigLabel,
  subs,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  tileClass: string
  big: string
  bigLabel: string
  subs: { value: string; label: string; valueClass?: string }[]
}) {
  return (
    <Card className="bg-background">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-center gap-2.5">
          <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${tileClass}`}>
            <Icon className="h-4 w-4" />
          </span>
          <p className="text-muted-foreground text-xs font-semibold uppercase tracking-[0.14em]">
            {label}
          </p>
        </div>

        <p className="text-foreground">
          <span className="text-3xl font-semibold">{big}</span>
          <span className="text-muted-foreground ml-2 text-sm">{bigLabel}</span>
        </p>

        <div className="grid grid-cols-3 gap-3 border-t border-border/60 pt-4">
          {subs.map((sub) => (
            <div key={sub.label} className="min-w-0">
              <p className={`text-sm font-semibold ${sub.valueClass ?? 'text-foreground'}`}>
                {sub.value}
              </p>
              <p className="text-muted-foreground mt-0.5 text-[10px] uppercase tracking-wide">
                {sub.label}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export default function OverviewStatCards({ telemetry }: OverviewStatCardsProps) {
  const { traffic, spend, performance, quality, tokenComposition } = telemetry
  const totalInput =
    tokenComposition.regularInput + tokenComposition.cacheRead + tokenComposition.cacheWrite

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <StatCard
        icon={IconActivity}
        label="Traffic"
        tileClass="bg-emerald-950 text-emerald-400"
        big={formatCompact(traffic.requests)}
        bigLabel="requests"
        subs={[
          { value: formatCompact(totalInput), label: 'Input' },
          { value: formatCompact(traffic.outputTokens), label: 'Output' },
          { value: formatCompact(tokenComposition.cacheRead), label: 'Cache read' },
        ]}
      />
      <StatCard
        icon={IconCurrencyDollar}
        label="Spend & Value"
        tileClass="bg-amber-950 text-amber-400"
        big={formatMicrosUsd(spend.costMicros)}
        bigLabel="tracked cost"
        subs={[
          {
            value: formatMicrosUsd(spend.valueSavedMicros),
            label: 'Value saved',
            valueClass: 'text-emerald-500',
          },
          {
            value: formatMicrosUsd(Math.round(spend.costMicros / Math.max(traffic.requests, 1))),
            label: 'Cost / Request',
          },
          { value: `${quality.requestsCoverage}%`, label: 'Pricing coverage' },
        ]}
      />
      <StatCard
        icon={IconShieldCheck}
        label="Reliability"
        tileClass="bg-emerald-950 text-emerald-400"
        big={traffic.requests > 0 ? `${performance.successRate}%` : '—'}
        bigLabel="successful"
        subs={[
          {
            value: `${traffic.failed}`,
            label: 'Failed',
            valueClass: traffic.failed > 0 ? 'text-red-500' : undefined,
          },
          { value: formatLatency(performance.avgLatencyMs), label: 'Avg latency' },
          { value: formatLatency(performance.ttftMs), label: 'TTFT' },
        ]}
      />
    </div>
  )
}
