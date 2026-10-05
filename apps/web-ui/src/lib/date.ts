import { format as formatDateFn } from 'date-fns'

import type { UsageActivity, UsageActivityDay } from '@/lib/api/models/usage'

import { type Second } from '@/types/time'

/**
 * Convert time string to milliseconds
 * Supports: ms, s, sec, m, min, h, hr, d, day, w, week, y, year
 * @param value - Time string (e.g., "7d", "2h", "30min", "1.5h")
 * @returns Milliseconds
 * @throws Error if invalid format or unsupported unit
 * @example
 * ms("2d") // 172800000
 * ms("1.5h") // 5400000
 * ms("30min") // 1800000
 */
export function ms(value: string | number): Second {
  // If already a number, assume it's milliseconds
  if (typeof value === 'number') {
    if (isNaN(value) || !isFinite(value)) {
      throw new Error('Invalid number provided')
    }
    return Math.abs(value)
  }

  // Validate input
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error('Invalid input: expected non-empty string')
  }

  // Normalize input: trim and convert to lowercase
  const normalized = value.trim().toLowerCase()

  // Match number and unit using regex
  const match = normalized.match(
    /^(-?\d*\.?\d+)\s*(ms|milliseconds?|s|secs?|seconds?|m|mins?|minutes?|h|hrs?|hours?|d|days?|w|weeks?|y|years?)$/i
  )

  if (!match) {
    throw new Error(`Invalid time format: "${value}". Expected format like "2d", "1.5h", "30min"`)
  }

  const [, numStr, unit] = match
  const num = parseFloat(numStr)

  if (isNaN(num) || !isFinite(num)) {
    throw new Error(`Invalid number: "${numStr}"`)
  }

  const MS_PER_SECOND = 1000
  const MS_PER_MINUTE = 60 * MS_PER_SECOND
  const MS_PER_HOUR = 60 * MS_PER_MINUTE
  const MS_PER_DAY = 24 * MS_PER_HOUR
  const MS_PER_WEEK = 7 * MS_PER_DAY
  const MS_PER_YEAR = 365.25 * MS_PER_DAY

  // Time unit conversion factors (to milliseconds)
  const conversions: Record<string, number> = {
    // Milliseconds
    ms: 1,
    millisecond: 1,
    milliseconds: 1,

    // Seconds
    s: MS_PER_SECOND,
    sec: MS_PER_SECOND,
    secs: MS_PER_SECOND,
    second: MS_PER_SECOND,
    seconds: MS_PER_SECOND,

    // Minutes
    m: MS_PER_MINUTE,
    min: MS_PER_MINUTE,
    mins: MS_PER_MINUTE,
    minute: MS_PER_MINUTE,
    minutes: MS_PER_MINUTE,

    // Hours
    h: MS_PER_HOUR,
    hr: MS_PER_HOUR,
    hrs: MS_PER_HOUR,
    hour: MS_PER_HOUR,
    hours: MS_PER_HOUR,

    // Days
    d: MS_PER_DAY,
    day: MS_PER_DAY,
    days: MS_PER_DAY,

    // Weeks
    w: MS_PER_WEEK,
    week: MS_PER_WEEK,
    weeks: MS_PER_WEEK,

    // Years (approximate: 365.25 days)
    y: MS_PER_YEAR,
    year: MS_PER_YEAR,
    years: MS_PER_YEAR,
  }

  const factor = conversions[unit]
  if (factor === undefined) {
    throw new Error(`Unsupported time unit: "${unit}"`)
  }

  const result = Math.abs(num * factor)

  // Check for overflow
  if (!isFinite(result)) {
    throw new Error(`Result overflow: "${value}" produces infinite milliseconds`)
  }

  return Math.round(result)
}

/**
 * Format date using date-fns
 * @param date - Date to format
 * @param formatStr - Format string (default: 'dd/MM/yyyy')
 * @returns Formatted date string
 */
export function formatDate(
  date: Date | string | number | null | undefined,
  formatStr?: string
): string {
  if (!date) return '-'
  return formatDateFn(date, formatStr || 'dd/MM/yyyy')
}

/**
 * Format date with time (dd/MM/yyyy, HH:mm:ss)
 */
export function formatDateTime(date: Date | string | number | null | undefined): string {
  return formatDate(date, 'dd/MM/yyyy, HH:mm:ss')
}

/**
 * Wall-clock time only (HH:mm:ss)
 */
export function formatClock(date: Date | string | number): string {
  return formatDateFn(date, 'HH:mm:ss')
}

/**
 * Relative age, e.g. "just now", "5m ago", "3h ago", "2d ago"
 */
export function formatTimeAgo(date: Date | string | number): string {
  const minutes = Math.floor((Date.now() - new Date(date).getTime()) / 60_000)

  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`

  return `${Math.floor(hours / 24)}d ago`
}

/**
 * Duration in seconds as "Nd Nh Nm" (e.g. uptime)
 */
export function formatDuration(seconds: number): string {
  const days = Math.floor(seconds / 86_400)
  const hours = Math.floor((seconds % 86_400) / 3_600)
  const minutes = Math.floor((seconds % 3_600) / 60)

  return `${days}d ${hours}h ${minutes}m`
}

export const DAY_MS = 86_400_000

const dayFormat = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
})
const longDayFormat = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
})
const shortMonthFormat = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  timeZone: 'UTC',
})
const integerFormat = new Intl.NumberFormat('en-US')

export type ActivityCell = {
  key: string
  time: number
  requests: number
  level: number
  day?: UsageActivityDay
}

/**
 * Lay a UsageActivity window out as week columns (Sunday → Saturday rows),
 * GitHub style. Days are UTC, matching the server's aggregation. Intensity
 * is the day's share of the busiest day, in quarters.
 */
export function buildActivityCalendar(activity: UsageActivity) {
  const byDay = new Map(activity.days.map((d) => [d.day, d]))
  const max = activity.days.reduce((m, d) => Math.max(m, d.requests), 0)
  const start = Date.parse(`${activity.from}T00:00:00Z`)
  const end = Date.parse(`${activity.to}T00:00:00Z`)

  const weeks: (ActivityCell | null)[][] = []
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
    months.push({ week: i, label: shortMonthFormat.format(first.time) })
  })
  if (months.length > 1 && months[1].week - months[0].week < 3) months.shift()

  const busiest = activity.days.reduce<UsageActivityDay | undefined>(
    (best, d) => (!best || d.requests > best.requests ? d : best),
    undefined
  )

  return { weeks, months, max, busiest }
}

export function activityCellLabel(cell: ActivityCell): string {
  const count =
    cell.requests === 0 ? 'No requests' : `${integerFormat.format(cell.requests)} requests`
  return `${count} on ${longDayFormat.format(cell.time)}`
}

/** Legend ranges for each level, from the max-based quarters. */
export function activityLevelRange(level: number, max: number): string {
  if (level === 0) return 'No requests'
  const lo = Math.floor(((level - 1) / 4) * max) + 1
  const hi = Math.floor((level / 4) * max)
  return lo >= hi
    ? `${integerFormat.format(hi)} requests`
    : `${integerFormat.format(lo)}–${integerFormat.format(hi)} requests`
}

/** Short date for a calendar day, e.g. "Mon, Oct 5, 2026". */
export function formatActivityDay(time: number): string {
  return dayFormat.format(time)
}

/** Integer grouping for request counts, e.g. "12,345". */
export function formatCount(n: number): string {
  return integerFormat.format(n)
}

/** Empty last-53-weeks window so a missing response still draws the grid. */
export function emptyActivity(): UsageActivity {
  const today = new Date()
  const to = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))
  const from = new Date(to)
  from.setUTCDate(from.getUTCDate() - from.getUTCDay() - 52 * 7)
  const day = (d: Date) => d.toISOString().slice(0, 10)
  return { from: day(from), to: day(to), total_requests: 0, active_days: 0, days: [] }
}
