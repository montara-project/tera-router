import {
  IconBan,
  IconEyeOff,
  IconListDetails,
  IconShieldCheck,
  IconClockPause,
  IconTrendingUp,
  IconAlertTriangle,
} from '@tabler/icons-react'

import type {
  GuardrailBreakdownRow,
  GuardrailCountRow,
  GuardrailMetrics,
} from '@/lib/api/models/guardrails'
import type { UsageRange } from '@/lib/api/models/usage'

import SegmentedControl from '@/components/block/common/segmented-control'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCompact, formatCount, niceStep } from '@/lib/format'

const RANGES = [
  { value: 'today', label: 'Today' },
  { value: '24h', label: '24h' },
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
  { value: '90d', label: '90d' },
] as const satisfies readonly { value: UsageRange; label: string }[]

const SERIES = [
  { key: 'blocked', label: 'Blocked', className: 'bg-red-500' },
  { key: 'masked', label: 'Masked', className: 'bg-primary' },
  { key: 'warned', label: 'Warned', className: 'bg-amber-500' },
  { key: 'logged', label: 'Log only', className: 'bg-muted-foreground/40' },
] as const

/** At most this many x-axis labels, spread evenly. */
const MAX_LABELS = 7

const pct = (value: number, total: number) =>
  total > 0 ? `${((value / total) * 100).toFixed(0)}%` : '0%'

interface GuardrailsOverviewProps {
  metrics?: GuardrailMetrics
  range: UsageRange
  onRangeChange: (range: UsageRange) => void
}

/** Overview tab: range control, decision counters, the actions chart and the
 * breakdown panels the gateway's decisions feed. */
export default function GuardrailsOverview({
  metrics,
  range,
  onRangeChange,
}: GuardrailsOverviewProps) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-end">
        <SegmentedControl
          aria-label="Time range"
          options={RANGES}
          value={range}
          onChange={onRangeChange}
        />
      </div>

      <StatStrip metrics={metrics} />
      {metrics ? (
        <>
          <ActionsChart metrics={metrics} />
          <div className="grid gap-4 lg:grid-cols-2">
            <BreakdownPanel
              icon={IconShieldCheck}
              title="By detector"
              description="Requests per detector"
              rows={metrics.detectors}
            />
            <CountPanel
              icon={IconListDetails}
              title="Top reasons"
              description="Most frequent matches"
              rows={metrics.reasons}
            />
            <BreakdownPanel
              icon={IconBan}
              title="API keys most affected"
              description="Ranked by blocked, then masked"
              rows={metrics.keys}
            />
            <BreakdownPanel
              icon={IconTrendingUp}
              title="Models most affected"
              description="Ranked by blocked, then masked"
              rows={metrics.models}
            />
          </div>
          <CountPanel
            icon={IconEyeOff}
            title="Detected entities"
            description="Findings across every decision"
            rows={metrics.entities}
          />
        </>
      ) : (
        <div className="grid gap-4">
          <Skeleton className="h-64 w-full rounded-lg" />
          <Skeleton className="h-40 w-full rounded-lg" />
        </div>
      )}
    </div>
  )
}

/** Six joined tiles: the window's decision counters and screening cost. */
function StatStrip({ metrics }: { metrics?: GuardrailMetrics }) {
  const checked = metrics?.checked ?? 0
  const cards = [
    {
      label: 'Checked',
      icon: IconShieldCheck,
      value: metrics ? formatCount(metrics.checked) : '',
      detail: metrics
        ? `${formatCount(metrics.blocked + metrics.masked + metrics.warned + metrics.logged)} decisions`
        : '',
    },
    {
      label: 'Blocked',
      icon: IconBan,
      value: metrics ? formatCount(metrics.blocked) : '',
      detail: `${pct(metrics?.blocked ?? 0, checked)} of checked`,
    },
    {
      label: 'Masked',
      icon: IconEyeOff,
      value: metrics ? formatCount(metrics.masked) : '',
      detail: `${pct(metrics?.masked ?? 0, checked)} of checked`,
    },
    {
      label: 'Warned',
      icon: IconAlertTriangle,
      value: metrics ? formatCount(metrics.warned) : '',
      detail: `${pct(metrics?.warned ?? 0, checked)} of checked`,
    },
    {
      label: 'Overhead p95',
      icon: IconClockPause,
      value: metrics ? (metrics.overhead.samples > 0 ? `${metrics.overhead.p95} ms` : '—') : '',
      detail:
        metrics && metrics.overhead.samples > 0
          ? `p50 ${metrics.overhead.p50} ms · avg ${metrics.overhead.avg} ms`
          : 'Not measured yet',
    },
    {
      label: 'Log only',
      icon: IconListDetails,
      value: metrics ? formatCount(metrics.logged) : '',
      detail: `${pct(metrics?.logged ?? 0, checked)} of checked`,
    },
  ]

  return (
    <dl className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {cards.map((card) => (
        <div key={card.label} className="relative flex flex-col gap-0.5 bg-card py-3.5 pr-4 pl-15">
          <span className="bg-primary/10 text-primary absolute top-3.5 left-4 flex size-8 items-center justify-center rounded-md">
            <card.icon className="size-4" stroke={1.75} aria-hidden />
          </span>
          <dt className="text-muted-foreground text-xs font-medium">{card.label}</dt>
          <dd className="text-foreground text-xl font-semibold tracking-[-0.01em] tabular-nums">
            {card.value || <Skeleton className="my-1 h-5 w-10" />}
          </dd>
          <dd className="text-muted-foreground min-h-5 text-xs">{card.detail}</dd>
        </div>
      ))}
    </dl>
  )
}

/** Stacked bars, one per bucket, split by the decision kind. */
function ActionsChart({ metrics }: { metrics: GuardrailMetrics }) {
  const total = (point: GuardrailMetrics['series'][number]) =>
    point.blocked + point.masked + point.warned + point.logged
  const affected = metrics.series.reduce((sum, point) => sum + total(point), 0)
  const max = Math.max(...metrics.series.map(total), 0)
  // Decision counts are whole numbers, so round the axis step up rather than
  // printing half a decision on the gridline.
  const step = Math.max(1, Math.ceil(niceStep(max)))
  const top = step * 4
  const ticks = [4, 3, 2, 1, 0].map((i) => step * i)
  const labelEvery = Math.max(1, Math.ceil(metrics.series.length / MAX_LABELS))

  return (
    <section className="overflow-hidden rounded-lg border border-border bg-card">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <IconTrendingUp className="text-primary size-4 shrink-0" stroke={1.75} aria-hidden />
          <div className="min-w-0">
            <h2 className="text-[13px] font-semibold">Guardrail actions over time</h2>
            <p className="text-muted-foreground text-xs">
              {formatCount(affected)} of {formatCount(metrics.checked)} requests affected
            </p>
          </div>
        </div>
        <div className="text-muted-foreground flex flex-wrap items-center gap-3 text-xs">
          {SERIES.map((series) => (
            <span key={series.key} className="flex items-center gap-1.5">
              <span className={`size-2 rounded-[2px] ${series.className}`} aria-hidden />
              {series.label}
            </span>
          ))}
        </div>
      </header>

      <div className="min-w-0 px-4 pt-5 pb-3">
        {affected === 0 ? (
          <p className="text-muted-foreground flex h-52 items-center justify-center text-[12.5px]">
            No measurements in this range.
          </p>
        ) : (
          <div className="flex gap-2">
            <div
              className="text-muted-foreground flex w-8 shrink-0 flex-col justify-between pb-6 text-right text-[11px] tabular-nums"
              aria-hidden
            >
              {ticks.map((tick) => (
                <span
                  key={tick}
                  className="-translate-y-1/2 leading-none first:translate-y-0 last:translate-y-0"
                >
                  {formatCompact(tick)}
                </span>
              ))}
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
              <div
                className="relative flex min-h-52 flex-1 items-end gap-[3px] border-b border-border"
                role="img"
                aria-label={`Guardrail actions per bucket: ${metrics.series
                  .map((point) => `${point.bucket} ${total(point)} decisions`)
                  .join(', ')}`}
              >
                {ticks.slice(0, 4).map((tick) => (
                  <span
                    key={tick}
                    className="pointer-events-none absolute inset-x-0 border-t border-dashed border-border/70"
                    style={{ bottom: `${(tick / top) * 100}%` }}
                    aria-hidden
                  />
                ))}
                {metrics.series.map((point) => {
                  const bucketTotal = total(point)
                  return (
                    <div
                      key={point.bucket}
                      title={`${point.bucket}: ${bucketTotal} decisions`}
                      className="relative h-full min-w-0 flex-1"
                    >
                      {bucketTotal > 0 && (
                        <div
                          className="absolute bottom-0 left-1/2 flex w-full max-w-4 -translate-x-1/2 flex-col overflow-hidden rounded-t-[2px]"
                          style={{ height: `${(bucketTotal / top) * 100}%` }}
                        >
                          {SERIES.map((series) => {
                            const value = point[series.key]
                            if (value === 0) return null
                            return (
                              <div
                                key={series.key}
                                className={series.className}
                                style={{ height: `${(value / bucketTotal) * 100}%` }}
                              />
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              <div
                className="text-muted-foreground flex gap-[3px] overflow-hidden pt-2 text-[11px]"
                aria-hidden
              >
                {metrics.series.map((point, index) => (
                  <span key={point.bucket} className="min-w-0 flex-1 text-center whitespace-nowrap">
                    {index % labelEvery === 0 ? point.bucket : ''}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

/** Panel listing one breakdown's ranked rows, with each row's share of the
 * busiest row drawn behind its label. */
function BreakdownPanel({
  icon: Icon,
  title,
  description,
  rows,
}: {
  icon: React.ElementType
  title: string
  description: string
  rows: GuardrailBreakdownRow[]
}) {
  const max = Math.max(...rows.map((row) => row.blocked + row.masked + row.warned + row.logged), 0)

  return (
    <Panel icon={Icon} title={title} description={description} empty={rows.length === 0}>
      {rows.map((row) => {
        const total = row.blocked + row.masked + row.warned + row.logged
        return (
          <div key={row.key} className="flex items-center gap-3 px-4 py-2.5">
            <span className="min-w-0 flex-1 truncate text-[13px]" title={row.label}>
              {row.label}
            </span>
            <span
              className="bg-muted hidden h-1.5 w-24 shrink-0 overflow-hidden rounded-full sm:block"
              aria-hidden
            >
              <span
                className="bg-primary block h-full rounded-full"
                style={{ width: `${max > 0 ? (total / max) * 100 : 0}%` }}
              />
            </span>
            <span className="text-muted-foreground w-8 shrink-0 text-right text-xs tabular-nums">
              {formatCount(total)}
            </span>
          </div>
        )
      })}
    </Panel>
  )
}

/** Panel listing one counter's ranked rows. */
function CountPanel({
  icon: Icon,
  title,
  description,
  rows,
}: {
  icon: React.ElementType
  title: string
  description: string
  rows: GuardrailCountRow[]
}) {
  const max = Math.max(...rows.map((row) => row.count), 0)

  return (
    <Panel icon={Icon} title={title} description={description} empty={rows.length === 0}>
      {rows.map((row) => (
        <div key={row.key} className="flex items-center gap-3 px-4 py-2.5">
          <span className="min-w-0 flex-1 truncate font-mono text-xs" title={row.key}>
            {row.key}
          </span>
          <span
            className="bg-muted hidden h-1.5 w-24 shrink-0 overflow-hidden rounded-full sm:block"
            aria-hidden
          >
            <span
              className="bg-primary block h-full rounded-full"
              style={{ width: `${max > 0 ? (row.count / max) * 100 : 0}%` }}
            />
          </span>
          <span className="text-muted-foreground w-8 shrink-0 text-right text-xs tabular-nums">
            {formatCount(row.count)}
          </span>
        </div>
      ))}
    </Panel>
  )
}

function Panel({
  icon: Icon,
  title,
  description,
  empty,
  children,
}: {
  icon: React.ElementType
  title: string
  description: string
  empty: boolean
  children: React.ReactNode
}) {
  return (
    <section className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card">
      <header className="flex items-center gap-2.5 border-b border-border px-4 py-3">
        <Icon className="text-primary size-4 shrink-0" stroke={1.75} aria-hidden />
        <div className="min-w-0">
          <h2 className="text-[13px] font-semibold">{title}</h2>
          <p className="text-muted-foreground text-xs">{description}</p>
        </div>
      </header>
      <div className="divide-y divide-border">
        {empty ? (
          <p className="text-muted-foreground flex h-20 items-center justify-center px-4 text-[12.5px]">
            No decisions in this range.
          </p>
        ) : (
          children
        )}
      </div>
    </section>
  )
}
