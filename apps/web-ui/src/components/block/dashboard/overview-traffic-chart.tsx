import { IconBolt, IconClock, IconCoin, IconStack2 } from '@tabler/icons-react'
import { useState } from 'react'

import type { UsageTelemetryOverview } from '@/lib/api/models/usage'

import { formatMicrosUsd } from '@/lib/currency'
import { formatCompact, formatCount, formatMs, niceStep } from '@/lib/format'
import { cn } from '@/lib/utils'

type Point = UsageTelemetryOverview['trend'][number]

const METRICS = [
  { value: 'requests', label: 'Requests', icon: IconBolt },
  { value: 'tokens', label: 'Tokens', icon: IconStack2 },
  { value: 'cost', label: 'Cost', icon: IconCoin },
  { value: 'latency', label: 'Latency', icon: IconClock },
] as const

type Metric = (typeof METRICS)[number]['value']

const VALUE: Record<Metric, (p: Point) => number> = {
  requests: (p) => p.requests,
  tokens: (p) => p.tokens,
  cost: (p) => p.costMicros,
  latency: (p) => p.latencyMs,
}

const FORMAT: Record<Metric, (n: number) => string> = {
  requests: formatCount,
  tokens: formatCompact,
  cost: formatMicrosUsd,
  latency: formatMs,
}

/** At most this many x-axis labels, spread evenly. */
const MAX_LABELS = 7

export default function OverviewTrafficChart({ telemetry }: { telemetry: UsageTelemetryOverview }) {
  const [metric, setMetric] = useState<Metric>('requests')
  const { trend, trendBusiest } = telemetry
  const value = VALUE[metric]
  const format = FORMAT[metric]

  const max = Math.max(...trend.map(value), 0)
  const step = niceStep(max)
  const top = step * 4
  const ticks = [4, 3, 2, 1, 0].map((i) => step * i)
  const labelEvery = Math.max(1, Math.ceil(trend.length / MAX_LABELS))

  const total =
    metric === 'latency'
      ? `Avg ${formatMs(telemetry.performance.avgLatencyMs)}`
      : `Total ${format(trend.reduce((sum, p) => sum + value(p), 0))}`

  return (
    <section className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-3">
          <div
            role="group"
            aria-label="Chart metric"
            className="inline-flex items-center gap-0.5 rounded-md border border-border p-0.5"
          >
            {METRICS.map((m) => (
              <button
                key={m.value}
                type="button"
                aria-pressed={metric === m.value}
                onClick={() => setMetric(m.value)}
                className={cn(
                  'inline-flex h-7 items-center gap-1.5 rounded-sm px-2.5 text-xs font-medium transition-colors',
                  metric === m.value
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <m.icon className="size-3.5" stroke={1.75} aria-hidden />
                {m.label}
              </button>
            ))}
          </div>
          <span className="text-muted-foreground text-xs tabular-nums">{total}</span>
        </div>
        {metric === 'requests' && (
          <div className="text-muted-foreground flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="bg-primary size-2 rounded-[2px]" aria-hidden />
              Succeeded
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-[2px] bg-orange-500" aria-hidden />
              Failed
            </span>
          </div>
        )}
      </header>

      <div className="flex min-h-64 flex-1 gap-2 px-4 pt-5 pb-3">
        <div
          className="text-muted-foreground flex w-10 shrink-0 flex-col justify-between pb-6 text-right text-[11px] tabular-nums"
          aria-hidden
        >
          {ticks.map((t) => (
            <span
              key={t}
              className="-translate-y-1/2 leading-none first:translate-y-0 last:translate-y-0"
            >
              {metric === 'cost' ? formatMicrosUsd(t) : formatCompact(t)}
            </span>
          ))}
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <div
            className="relative flex flex-1 items-end gap-[3px] border-b border-border"
            role="img"
            aria-label={`${METRICS.find((m) => m.value === metric)?.label} per bucket: ${trend
              .map((p) => `${p.day} ${format(value(p))}`)
              .join(', ')}`}
          >
            {ticks.slice(0, 4).map((t) => (
              <span
                key={t}
                className="pointer-events-none absolute inset-x-0 border-t border-dashed border-border/70"
                style={{ bottom: `${(t / top) * 100}%` }}
                aria-hidden
              />
            ))}
            {trend.map((p) => {
              const total = value(p)
              const failed = metric === 'requests' ? p.failures : 0
              return (
                <div
                  key={p.day}
                  title={`${p.day}: ${format(total)}${failed ? ` (${formatCount(failed)} failed)` : ''}`}
                  className="relative h-full min-w-0 flex-1"
                >
                  {total > 0 && (
                    <div
                      className="absolute bottom-0 left-1/2 flex w-full max-w-4 -translate-x-1/2 flex-col overflow-hidden rounded-t-[2px]"
                      style={{ height: `${(total / top) * 100}%` }}
                    >
                      {failed > 0 && (
                        <div
                          className="bg-orange-500"
                          style={{ height: `${(failed / total) * 100}%` }}
                        />
                      )}
                      <div className="bg-primary flex-1" />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          <div className="text-muted-foreground flex gap-[3px] pt-2 text-[11px]" aria-hidden>
            {trend.map((p, i) => (
              <span key={p.day} className="min-w-0 flex-1 text-center whitespace-nowrap">
                {i % labelEvery === 0 ? p.day : ''}
              </span>
            ))}
          </div>
        </div>
      </div>

      <footer className="text-muted-foreground border-t border-border px-4 py-2.5 text-xs">
        {trendBusiest ? `Busiest bucket ${trendBusiest}` : 'No traffic in this period'}
        {/^\d\d:00$/.test(trend[0]?.day ?? '') && ' · hours are in UTC'}
      </footer>
    </section>
  )
}
