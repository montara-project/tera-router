import { IconChartLine } from '@tabler/icons-react'
import { useMemo, useState } from 'react'

import type { UsageTelemetryOverview } from '@/lib/api/models/usage'

import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

import { fmtCompact, fmtMoney } from './format'

const METRICS = [
  { value: 'requests', label: 'Requests' },
  { value: 'tokens', label: 'Tokens' },
  { value: 'cost', label: 'Cost' },
  { value: 'failures', label: 'Failures' },
] as const

type Metric = (typeof METRICS)[number]['value']

function metricValue(point: UsageTelemetryOverview['trend'][number], metric: Metric): number {
  if (metric === 'requests') return point.requests
  if (metric === 'tokens') return point.tokens
  if (metric === 'cost') return point.costMicros
  return point.failures
}

/** smallest "nice" step so that 4 steps cover the max value */
function niceStep(max: number): number {
  const raw = max / 4
  const pow = 10 ** Math.floor(Math.log10(raw))
  for (const unit of [1, 1.5, 2, 2.5, 3, 4, 5, 7.5, 10]) {
    const step = unit * pow
    if (step >= raw) return step
  }
  return 10 * pow
}

export default function UsageTrendCard({ telemetry }: { telemetry: UsageTelemetryOverview }) {
  const { trend, trendBusiest: busiest } = telemetry
  const [metric, setMetric] = useState<Metric>('requests')

  const values = useMemo(() => trend.map((point) => metricValue(point, metric)), [trend, metric])
  const max = Math.max(...values, 1)
  const step = niceStep(max)
  const top = step * 4

  const width = 760
  const height = 250
  const padLeft = 46
  const padBottom = 26
  const plotWidth = width - padLeft - 12
  const plotHeight = height - 16 - padBottom

  const x = (index: number) => padLeft + (index / Math.max(values.length - 1, 1)) * plotWidth
  const y = (value: number) => 16 + plotHeight - (value / top) * plotHeight

  const linePath = values
    .map((value, index) => `${index === 0 ? 'M' : 'L'}${x(index).toFixed(1)},${y(value).toFixed(1)}`)
    .join(' ')
  const areaPath = `${linePath} L${x(values.length - 1).toFixed(1)},${y(0).toFixed(1)} L${x(0).toFixed(1)},${y(0).toFixed(1)} Z`

  const formatY = (value: number) => (metric === 'cost' ? fmtMoney(value) : fmtCompact(value))
  const gridValues = [0, step, step * 2, step * 3, top]
  const labelEvery = Math.ceil(trend.length / 10)

  return (
    <Card className="bg-background">
      <CardContent className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <IconChartLine className="h-4 w-4 text-muted-foreground" />
              Usage trend
            </p>
            <p className="text-muted-foreground mt-0.5 text-xs">Busiest request bucket {busiest}</p>
          </div>

          <div className="inline-flex items-center gap-1 rounded-lg border border-border bg-card p-1">
            {METRICS.map((item) => (
              <button
                key={item.value}
                type="button"
                aria-pressed={metric === item.value}
                onClick={() => setMetric(item.value)}
                className={cn(
                  'cursor-pointer rounded-md px-2.5 py-1 text-xs transition-colors',
                  metric === item.value
                    ? 'bg-accent font-medium text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="mt-4 w-full"
          role="img"
          aria-label={`Usage trend by ${metric}`}
        >
          <defs>
            <linearGradient id="usage-trend-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="currentColor" className="text-emerald-500" stopOpacity="0.18" />
              <stop offset="100%" stopColor="currentColor" className="text-emerald-500" stopOpacity="0" />
            </linearGradient>
          </defs>

          {gridValues.map((value) => (
            <g key={value}>
              <line
                x1={padLeft}
                x2={width - 12}
                y1={y(value)}
                y2={y(value)}
                className="stroke-border/60"
                strokeWidth="1"
              />
              <text x={padLeft - 8} y={y(value) + 3} textAnchor="end" className="fill-muted-foreground text-[10px]">
                {formatY(value)}
              </text>
            </g>
          ))}

          <path d={areaPath} fill="url(#usage-trend-fill)" />
          <path
            d={linePath}
            fill="none"
            className="stroke-emerald-500"
            strokeWidth="1.5"
            vectorEffect="non-scaling-stroke"
          />

          {trend.map((point, index) =>
            index % labelEvery === 0 ? (
              <text
                key={point.day}
                x={x(index)}
                y={height - 6}
                textAnchor="middle"
                className="fill-muted-foreground text-[10px]"
              >
                {point.day}
              </text>
            ) : null
          )}
        </svg>
      </CardContent>
    </Card>
  )
}
