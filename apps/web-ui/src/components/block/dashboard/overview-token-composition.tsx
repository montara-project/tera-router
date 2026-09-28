import { Layers } from 'lucide-react'

import type { UsageTelemetryOverview } from '@/lib/api/models/usage'

import { fmtCompact } from '@/components/block/cost-analytics/usage/format'
import { Card, CardContent } from '@/components/ui/card'

interface OverviewTokenCompositionProps {
  telemetry: UsageTelemetryOverview
}

export default function OverviewTokenComposition({
  telemetry,
}: OverviewTokenCompositionProps) {
  const { tokenComposition } = telemetry
  const total =
    tokenComposition.regularInput +
    tokenComposition.cacheRead +
    tokenComposition.cacheWrite +
    tokenComposition.output

  const segments = [
    {
      key: 'regularInput',
      label: 'Regular input',
      value: tokenComposition.regularInput,
      barClass: 'bg-amber-500',
      dotClass: 'bg-amber-500',
    },
    {
      key: 'cacheRead',
      label: 'Cache read',
      value: tokenComposition.cacheRead,
      barClass: 'bg-emerald-500',
      dotClass: 'bg-emerald-500',
    },
    {
      key: 'cacheWrite',
      label: 'Cache write',
      value: tokenComposition.cacheWrite,
      barClass: 'bg-amber-300',
      dotClass: 'bg-amber-300',
    },
    {
      key: 'output',
      label: 'Output',
      value: tokenComposition.output,
      barClass: 'bg-red-500',
      dotClass: 'bg-red-500',
    },
  ]

  return (
    <Card className="bg-background">
      <CardContent className="grid gap-6 p-5 lg:grid-cols-[220px_1fr] lg:items-center">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
            <Layers className="h-4 w-4 text-muted-foreground" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">Token composition</p>
            <p className="text-foreground mt-1">
              <span className="text-2xl font-semibold">{fmtCompact(total)}</span>
              <span className="text-muted-foreground ml-1.5 text-sm">tokens</span>
            </p>
            <p className="text-muted-foreground text-xs">
              {tokenComposition.requestCacheHits} request cache hits
            </p>
          </div>
        </div>

        <div className="min-w-0 space-y-4">
          <div
            className="flex h-2.5 overflow-hidden rounded-full bg-muted"
            role="img"
            aria-label={`Token composition: ${segments
              .map((segment) => `${fmtCompact(segment.value)} ${segment.label}`)
              .join(', ')}`}
          >
            {segments.map((segment) => {
              if (segment.value === 0) return null

              return (
                <div
                  key={segment.key}
                  className={segment.barClass}
                  title={`${segment.label}: ${fmtCompact(segment.value)}`}
                  style={{ width: `${(segment.value / total) * 100}%` }}
                />
              )
            })}
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
            {segments.map((segment) => {
              const share = total > 0 ? (segment.value / total) * 100 : 0

              return (
                <div key={segment.key} className="min-w-0">
                  <p className="text-muted-foreground flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em]">
                    <span className={`size-1.5 rounded-full ${segment.dotClass}`} />
                    {segment.label}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-foreground">
                    {fmtCompact(segment.value)}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {share.toFixed(1)}% of total
                    {segment.key === 'output' && tokenComposition.reasoning > 0
                      ? ` · ${fmtCompact(tokenComposition.reasoning)} reasoning`
                      : ''}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
