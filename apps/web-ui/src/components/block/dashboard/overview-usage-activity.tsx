import type { KeyboardEvent, RefObject } from 'react'

import { useQuery } from '@tanstack/react-query'
import { CalendarDays } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import type { UsageActivity, UsageActivityDay } from '@/lib/api/models/usage'

import { fmtCompact } from '@/components/block/cost-analytics/usage/format'
import { Card, CardContent } from '@/components/ui/card'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import { Skeleton } from '@/components/ui/skeleton'
import { usageQueries } from '@/lib/api/queries/usage'
import { cn } from '@/lib/utils'

const DAY_MS = 86_400_000
const MAX_MODELS = 5

/** Arrow keys move one day (rows) or one week (columns). */
const KEY_STEP_DAYS: Record<string, number> = {
  ArrowUp: -1,
  ArrowDown: 1,
  ArrowLeft: -7,
  ArrowRight: 7,
}

/** Intensity fills, index = level (0 = no requests). */
const LEVEL_CLASSES = [
  'bg-muted',
  'bg-emerald-200 dark:bg-emerald-900',
  'bg-emerald-300 dark:bg-emerald-700',
  'bg-emerald-500 dark:bg-emerald-500',
  'bg-emerald-600 dark:bg-emerald-300',
]

const WEEKDAY_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', '']

const dateFormat = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
})
const longDateFormat = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
})
const monthFormat = new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' })
const countFormat = new Intl.NumberFormat('en-US')

type Cell = {
  key: string
  time: number
  requests: number
  level: number
  day?: UsageActivityDay
}

/**
 * Lay the calendar out as week columns (Sunday → Saturday rows), GitHub
 * style. Days are UTC, matching the server's aggregation. Intensity is the
 * day's share of the busiest day, in quarters.
 */
function buildCalendar(activity: UsageActivity) {
  const byDay = new Map(activity.days.map((d) => [d.day, d]))
  const max = activity.days.reduce((m, d) => Math.max(m, d.requests), 0)
  const start = Date.parse(`${activity.from}T00:00:00Z`)
  const end = Date.parse(`${activity.to}T00:00:00Z`)

  const weeks: (Cell | null)[][] = []
  for (let time = start; time <= end; time += DAY_MS) {
    const key = new Date(time).toISOString().slice(0, 10)
    const day = byDay.get(key)
    const requests = day?.requests ?? 0
    const week = Math.floor((time - start) / (7 * DAY_MS))
    weeks[week] ??= Array.from({ length: 7 }, () => null)
    weeks[week][new Date(time).getUTCDay()] = {
      key,
      time,
      requests,
      level: requests === 0 ? 0 : Math.max(1, Math.ceil((requests / max) * 4)),
      day,
    }
  }

  // A month label sits over the first week whose Sunday falls in a new
  // month; the first column is labelled only if the next label is far
  // enough away not to overlap it.
  const months: { week: number; label: string }[] = []
  weeks.forEach((week, i) => {
    const first = week.find((cell) => cell !== null)
    if (!first) return
    const month = new Date(first.time).getUTCMonth()
    const prev = i > 0 ? weeks[i - 1].find((cell) => cell !== null) : undefined
    if (prev && new Date(prev.time).getUTCMonth() === month) return
    months.push({ week: i, label: monthFormat.format(first.time) })
  })
  if (months.length > 1 && months[1].week - months[0].week < 3) months.shift()

  const busiest = activity.days.reduce<UsageActivityDay | undefined>(
    (best, d) => (!best || d.requests > best.requests ? d : best),
    undefined
  )

  return { weeks, months, max, busiest }
}

function cellLabel(cell: Cell): string {
  const count =
    cell.requests === 0 ? 'No requests' : `${countFormat.format(cell.requests)} requests`
  return `${count} on ${longDateFormat.format(cell.time)}`
}

/** Legend ranges for each level, from the max-based quarters. */
function levelRange(level: number, max: number): string {
  if (level === 0) return 'No requests'
  const lo = Math.floor(((level - 1) / 4) * max) + 1
  const hi = Math.floor((level / 4) * max)
  return lo >= hi
    ? `${countFormat.format(hi)} requests`
    : `${countFormat.format(lo)}–${countFormat.format(hi)} requests`
}

export default function OverviewUsageActivity() {
  const { data } = useQuery(usageQueries.activity())

  return (
    <Card className="bg-background">
      <CardContent className="space-y-4 p-5">
        {data ? (
          <ActivityCalendar activity={data} />
        ) : (
          <Skeleton className="h-52 w-full rounded-lg" />
        )}
      </CardContent>
    </Card>
  )
}

function ActivityCalendar({ activity }: { activity: UsageActivity }) {
  const { weeks, months, max, busiest } = useMemo(() => buildCalendar(activity), [activity])

  const scrollRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const anchorRef = useRef<HTMLElement | null>(null)
  const [active, setActive] = useState<Cell | null>(null)
  const [focusKey, setFocusKey] = useState(activity.to)

  // Newest weeks matter most: start scrolled to today on narrow screens.
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollLeft = el.scrollWidth
  }, [])

  const show = (cell: Cell, el: HTMLElement) => {
    anchorRef.current = el
    setActive(cell)
  }

  // Roving focus: one tab stop for the whole grid, arrows move by day/week.
  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    let target: number | undefined
    const current = Date.parse(`${focusKey}T00:00:00Z`)
    if (e.key in KEY_STEP_DAYS) target = current + KEY_STEP_DAYS[e.key] * DAY_MS
    if (e.key === 'Home') target = Date.parse(`${activity.from}T00:00:00Z`)
    if (e.key === 'End') target = Date.parse(`${activity.to}T00:00:00Z`)
    if (e.key === 'Escape') {
      setActive(null)
      return
    }
    if (target === undefined) return
    e.preventDefault()
    const key = new Date(target).toISOString().slice(0, 10)
    const button = gridRef.current?.querySelector<HTMLButtonElement>(`[data-day="${key}"]`)
    if (!button) return
    setFocusKey(key)
    button.focus()
  }

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
            <CalendarDays className="h-4 w-4 text-muted-foreground" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">Usage activity</p>
            <p className="text-foreground mt-1">
              <span className="text-2xl font-semibold">{fmtCompact(activity.total_requests)}</span>
              <span className="text-muted-foreground ml-1.5 text-sm">
                requests in the last year
              </span>
            </p>
            <p className="text-muted-foreground text-xs">
              {activity.active_days} active {activity.active_days === 1 ? 'day' : 'days'}
              {busiest &&
                ` · busiest ${dateFormat.format(Date.parse(`${busiest.day}T00:00:00Z`))} (${countFormat.format(busiest.requests)})`}
            </p>
          </div>
        </div>
      </div>

      <div ref={scrollRef} className="overflow-x-auto pb-1">
        {/* One grid for labels and cells keeps them aligned while the cells
            stretch to the card width; min-width keeps them legible on phones. */}
        <div
          ref={gridRef}
          role="group"
          aria-label="Requests per day over the last 53 weeks. Use arrow keys to move between days."
          className="grid min-w-[640px] gap-[3px]"
          style={{ gridTemplateColumns: `1.75rem repeat(${weeks.length}, minmax(0, 1fr))` }}
          onPointerLeave={() => setActive(null)}
        >
          {months.map((m) => (
            <span
              key={`${m.week}-${m.label}`}
              aria-hidden
              className="text-muted-foreground pb-1 text-[11px] leading-none whitespace-nowrap"
              style={{ gridRow: 1, gridColumn: `${m.week + 2} / span 3` }}
            >
              {m.label}
            </span>
          ))}
          {WEEKDAY_LABELS.map((label, i) =>
            label ? (
              <span
                key={label}
                aria-hidden
                className="text-muted-foreground self-center text-[10px] leading-none"
                style={{ gridRow: i + 2, gridColumn: 1 }}
              >
                {label}
              </span>
            ) : null
          )}
          {weeks.flatMap((week, w) =>
            week.map((cell, d) =>
              cell ? (
                <button
                  key={cell.key}
                  type="button"
                  data-day={cell.key}
                  tabIndex={cell.key === focusKey ? 0 : -1}
                  aria-label={cellLabel(cell)}
                  style={{ gridRow: d + 2, gridColumn: w + 2 }}
                  className={cn(
                    'aspect-square w-full cursor-pointer rounded-[3px] outline-offset-1 transition-shadow hover:ring-1 hover:ring-foreground/40 focus-visible:outline-2 focus-visible:outline-emerald-400 motion-reduce:transition-none',
                    LEVEL_CLASSES[cell.level],
                    active?.key === cell.key && 'ring-1 ring-foreground/60'
                  )}
                  onKeyDown={handleKeyDown}
                  onPointerEnter={(e) => show(cell, e.currentTarget)}
                  onFocus={(e) => {
                    setFocusKey(cell.key)
                    show(cell, e.currentTarget)
                  }}
                  onClick={(e) => show(cell, e.currentTarget)}
                />
              ) : null
            )
          )}
        </div>
      </div>

      <div className="text-muted-foreground flex flex-wrap items-center justify-between gap-2 text-xs">
        <span>Days are in UTC, matching server time.</span>
        <div className="flex items-center gap-1.5">
          <span>Less</span>
          {LEVEL_CLASSES.map((cls, level) => (
            <span
              key={level}
              className={cn('size-[11px] rounded-[2px]', cls)}
              title={levelRange(level, max)}
              aria-label={levelRange(level, max)}
              role="img"
            />
          ))}
          <span>More</span>
        </div>
      </div>

      <Popover open={active !== null} onOpenChange={(open) => !open && setActive(null)}>
        <PopoverAnchor virtualRef={anchorRef as RefObject<HTMLElement>} />
        <PopoverContent
          side="top"
          sideOffset={6}
          className="pointer-events-none w-64 p-3 motion-reduce:animate-none"
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          {active && <DayDetails cell={active} />}
        </PopoverContent>
      </Popover>
    </>
  )
}

function DayDetails({ cell }: { cell: Cell }) {
  const models = cell.day?.models ?? []
  const shown = models.slice(0, MAX_MODELS)
  const failed = cell.day?.failed ?? 0

  return (
    <div className="space-y-2.5">
      <div>
        <p className="text-muted-foreground text-xs">{dateFormat.format(cell.time)}</p>
        <p className="text-sm font-semibold text-foreground">
          {cell.requests === 0
            ? 'No requests'
            : `${countFormat.format(cell.requests)} ${cell.requests === 1 ? 'request' : 'requests'}`}
          {failed > 0 && (
            <span className="text-destructive ml-1.5 text-xs font-medium">
              {countFormat.format(failed)} failed
            </span>
          )}
        </p>
      </div>

      {shown.length > 0 && (
        <ul className="space-y-2 border-t border-border pt-2.5">
          {shown.map((m) => (
            <li key={`${m.provider}/${m.model}`} className="space-y-1">
              <div className="flex items-baseline justify-between gap-3">
                <span
                  className="min-w-0 truncate font-mono text-xs text-foreground"
                  title={m.model}
                >
                  {m.model}
                </span>
                <span className="shrink-0 text-xs font-medium tabular-nums text-foreground">
                  {countFormat.format(m.requests)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-emerald-500"
                    style={{ width: `${(m.requests / cell.requests) * 100}%` }}
                  />
                </div>
                <span className="text-muted-foreground w-20 shrink-0 truncate text-right text-[10px]">
                  {m.provider_name}
                </span>
              </div>
            </li>
          ))}
          {models.length > MAX_MODELS && (
            <li className="text-muted-foreground text-[11px]">
              +{models.length - MAX_MODELS} more{' '}
              {models.length - MAX_MODELS === 1 ? 'model' : 'models'}
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
