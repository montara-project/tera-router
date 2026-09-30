import { Activity, DollarSign, ShieldCheck } from 'lucide-react'

import type { UsageTelemetryOverview } from '@/lib/api/models/usage'

import { Card, CardContent } from '@/components/ui/card'

import { fmtCompact, fmtLatency, fmtMoney } from './format'

interface OverviewCardsProps {
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

export default function UsageOverviewCards({ telemetry }: OverviewCardsProps) {
  const { traffic, spend, performance } = telemetry

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <StatCard
        icon={Activity}
        label="Traffic"
        tileClass="bg-emerald-950 text-emerald-400"
        big={fmtCompact(traffic.requests)}
        bigLabel="requests"
        subs={[
          { value: fmtCompact(traffic.inputTokens + traffic.outputTokens), label: 'Tokens' },
          { value: `${traffic.success} / ${traffic.failed}`, label: 'Success / Failed' },
          {
            value: `${fmtCompact(traffic.inputTokens)} / ${fmtCompact(traffic.outputTokens)}`,
            label: 'Input / Output',
          },
        ]}
      />
      <StatCard
        icon={DollarSign}
        label="Spend & Savings"
        tileClass="bg-amber-950 text-amber-400"
        big={fmtMoney(spend.costMicros)}
        bigLabel="tracked cost"
        subs={[
          {
            value: fmtMoney(spend.valueSavedMicros),
            label: 'Value saved',
            valueClass: 'text-emerald-500',
          },
          {
            value: fmtMoney(Math.round(spend.costMicros / Math.max(traffic.requests, 1))),
            label: 'Cost / Request',
          },
          { value: fmtCompact(spend.tokensSaved), label: 'Tokens saved' },
        ]}
      />
      <StatCard
        icon={ShieldCheck}
        label="Performance"
        tileClass="bg-emerald-950 text-emerald-400"
        big={`${performance.successRate}%`}
        bigLabel="successful"
        subs={[
          { value: fmtLatency(performance.avgLatencyMs), label: 'Avg latency' },
          { value: fmtLatency(performance.ttftMs), label: 'TTFT' },
          { value: fmtCompact(performance.tokensPerRequest), label: 'Tokens / Request' },
        ]}
      />
    </div>
  )
}
