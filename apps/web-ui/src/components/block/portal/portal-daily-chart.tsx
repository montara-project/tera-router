import { IconChartBar } from '@tabler/icons-react'
import { useState } from 'react'

import type { PortalDay } from '@/lib/api/models/portal'

import DashboardPanel from '@/components/block/dashboard/dashboard-panel'
import { formatMicrosUsd } from '@/lib/currency'
import { formatCompact, formatCount, niceStep } from '@/lib/format'
import { cn } from '@/lib/utils'

const METRICS = [
  { value: 'tokens', label: 'Tokens' },
  { value: 'requests', label: 'Requests' },
  { value: 'spend', label: 'Spend' },
] as const

type Metric = (typeof METRICS)[number]['value']

const MAX_LABELS = 7

/** Every UTC day of the window, oldest first, with quiet days as zeros. */
function fillDays(daily: PortalDay[], days: number): PortalDay[] {
  const byDay = new Map(daily.map((d) => [d.day, d]))
  const today = new Date()
  return Array.from({ length: days }, (_, i) => {
    const date = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - (days - 1 - i))
    )
    const day = date.toISOString().slice(0, 10)
    return (
      byDay.get(day) ?? { day, requests: 0, prompt_tokens: 0, completion_tokens: 0, cost_micros: 0 }
    )
  })
}

const dayLabel = (day: string) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })

/** Daily bars for the window: input/output tokens stacked, or requests or spend. */
export default function PortalDailyChart({ daily, days }: { daily: PortalDay[]; days: number }) {
  const [metric, setMetric] = useState<Metric>('tokens')
  const series = fillDays(daily, days)

  const total = (d: PortalDay) =>
    metric === 'tokens'
      ? d.prompt_tokens + d.completion_tokens
      : metric === 'requests'
        ? d.requests
        : d.cost_micros
  const format = (n: number) =>
    metric === 'spend'
      ? formatMicrosUsd(n)
      : metric === 'requests'
        ? formatCount(n)
        : formatCompact(n)

  const step = niceStep(Math.max(...series.map(total), 0))
  const top = step * 4
  const ticks = [4, 3, 2, 1, 0].map((i) => step * i)
  const labelEvery = Math.max(1, Math.ceil(series.length / MAX_LABELS))

  return (
    <DashboardPanel
      icon={IconChartBar}
      title="Daily usage"
      className="h-full"
      toolbar={
        <div className="flex flex-wrap items-center gap-3">
          {metric === 'tokens' ? (
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="bg-primary size-2 rounded-[2px]" aria-hidden />
                Input
              </span>
              <span className="flex items-center gap-1.5">
                <span className="bg-primary/45 size-2 rounded-[2px]" aria-hidden />
                Output
              </span>
            </div>
          ) : null}
          <div
            role="group"
            aria-label="Chart metric"
            className="inline-flex items-center gap-0.5 rounded-md border border-border bg-muted/40 p-0.5"
          >
            {METRICS.map((m) => (
              <button
                key={m.value}
                type="button"
                aria-pressed={metric === m.value}
                onClick={() => setMetric(m.value)}
                className={cn(
                  'inline-flex h-7 items-center rounded-sm px-2.5 text-xs font-medium transition-colors',
                  metric === m.value
                    ? 'bg-card text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      }
    >
      <div className="flex min-h-64 flex-1 gap-2 px-4 pt-4 pb-3">
        <div
          className="flex w-12 shrink-0 flex-col justify-between pb-6 text-right text-[11px] text-muted-foreground tabular-nums"
          aria-hidden
        >
          {ticks.map((t) => (
            <span
              key={t}
              className="-translate-y-1/2 leading-none first:translate-y-0 last:translate-y-0"
            >
              {metric === 'spend' ? formatMicrosUsd(t) : formatCompact(t)}
            </span>
          ))}
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <div
            className="relative flex flex-1 items-end gap-[2px] border-b border-border"
            role="img"
            aria-label={`${METRICS.find((m) => m.value === metric)?.label} per day: ${
              series
                .filter((d) => total(d) > 0)
                .map((d) => `${dayLabel(d.day)} ${format(total(d))}`)
                .join(', ') || 'no traffic'
            }`}
          >
            {ticks.slice(0, 4).map((t) => (
              <span
                key={t}
                className="pointer-events-none absolute inset-x-0 border-t border-dashed border-border/70"
                style={{ bottom: `${(t / top) * 100}%` }}
                aria-hidden
              />
            ))}
            {series.map((d) => {
              const value = total(d)
              const output = metric === 'tokens' ? d.completion_tokens : 0
              return (
                <div
                  key={d.day}
                  title={`${dayLabel(d.day)}: ${format(value)}${
                    metric === 'tokens'
                      ? ` (${formatCompact(d.prompt_tokens)} in · ${formatCompact(output)} out)`
                      : ''
                  }`}
                  className="relative h-full min-w-0 flex-1"
                >
                  {value > 0 && top > 0 ? (
                    <div
                      className="absolute bottom-0 left-1/2 flex w-full max-w-10 -translate-x-1/2 flex-col gap-px overflow-hidden rounded-t-[2px]"
                      style={{ height: `${Math.max((value / top) * 100, 1)}%` }}
                    >
                      {output > 0 ? (
                        <div
                          className="bg-primary/45"
                          style={{ height: `${(output / value) * 100}%` }}
                        />
                      ) : null}
                      <div className="bg-primary flex-1" />
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
          <div className="flex gap-[2px] pt-2 text-[11px] text-muted-foreground" aria-hidden>
            {series.map((d, i) => (
              <span key={d.day} className="min-w-0 flex-1 text-center whitespace-nowrap">
                {i % labelEvery === 0 ? dayLabel(d.day) : ''}
              </span>
            ))}
          </div>
        </div>
      </div>
    </DashboardPanel>
  )
}
