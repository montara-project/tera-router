import { IconArrowDownRight, IconArrowUpRight } from '@tabler/icons-react'

import { formatCount } from '@/lib/format'
import { cn } from '@/lib/utils'

export type StatCard = {
  label: string
  icon: React.ElementType
  value: string
  /** Extra figure under the value (e.g. p95). */
  detail?: string
  series: number[]
  /** Change vs the previous window, or null when it had no traffic. */
  delta: { text: string; up: boolean; good: boolean } | null
}

/** Signed change text; `better` says which direction is an improvement. */
export function change(
  current: number,
  previous: number,
  hasPrevious: boolean,
  format: (diff: number) => string,
  better: 'up' | 'down'
): StatCard['delta'] {
  if (!hasPrevious) return null
  const diff = current - previous
  const up = diff >= 0
  return { text: `${up ? '+' : '−'}${format(Math.abs(diff))}`, up, good: up === (better === 'up') }
}

export function relative(current: number, previous: number) {
  return (diff: number) =>
    previous > 0 ? `${((diff / previous) * 100).toFixed(1)}%` : `${formatCount(current)}`
}

/** Joined row of metric cards: icon tile, label, value + sparkline, change line. */
export default function StatCardGrid({ cards }: { cards: StatCard[] }) {
  return (
    <dl className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <div key={card.label} className="relative flex flex-col gap-0.5 bg-card py-3.5 pr-4 pl-15">
          <span className="bg-primary/10 text-primary absolute top-3.5 left-4 flex size-8 items-center justify-center rounded-md">
            <card.icon className="size-4" stroke={1.75} aria-hidden />
          </span>
          <dt className="text-muted-foreground text-xs font-medium">{card.label}</dt>
          <dd className="flex items-center justify-between gap-3">
            <span className="text-xl font-semibold tracking-[-0.01em] text-foreground tabular-nums">
              {card.value}
            </span>
            <Sparkline values={card.series} />
          </dd>
          <dd className="text-muted-foreground flex min-h-5 items-center gap-1.5 text-xs">
            {card.delta ? (
              <span
                className={cn(
                  'inline-flex items-center gap-0.5 font-medium tabular-nums',
                  card.delta.good
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : 'text-red-700 dark:text-red-400'
                )}
              >
                {card.delta.up ? (
                  <IconArrowUpRight className="size-3.5" aria-hidden />
                ) : (
                  <IconArrowDownRight className="size-3.5" aria-hidden />
                )}
                {card.delta.text}
              </span>
            ) : (
              <span>No prior data</span>
            )}
            {card.delta && <span>vs prior period</span>}
          </dd>
          {card.detail && (
            <dd className="text-muted-foreground truncate text-xs tabular-nums" title={card.detail}>
              {card.detail}
            </dd>
          )}
        </div>
      ))}
    </dl>
  )
}

/** 72×24 trend line with a soft area fill; decorative, the value carries it. */
function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null
  const max = Math.max(...values, 1)
  const step = 72 / (values.length - 1)
  const points = values.map(
    (v, i) => `${(i * step).toFixed(1)},${(22 - (v / max) * 20).toFixed(1)}`
  )
  const line = `M${points.join(' L')}`

  return (
    <svg viewBox="0 0 72 24" className="text-primary h-6 w-18 shrink-0" aria-hidden>
      <path d={`${line} L72,24 L0,24 Z`} className="fill-current opacity-10" />
      <path
        d={line}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}
