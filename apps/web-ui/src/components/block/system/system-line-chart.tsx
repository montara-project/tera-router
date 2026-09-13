import { useId } from 'react'

import type { SystemPoint } from '@/lib/api/models/system'

import { formatClock } from './formatters'

interface SystemLineChartProps {
  points: SystemPoint[]
  /** Stroke / fill color (hex) */
  color: string
  /** Fixed y-scale; omit to compute a nice scale from the data */
  min?: number
  max?: number
  /** Optional dashed reference line (e.g. 80% warning) */
  threshold?: number
  /** Render a gradient area under the line */
  area?: boolean
  className?: string
}

const WIDTH = 640
const HEIGHT = 230
const PADDING = { top: 10, right: 12, bottom: 26, left: 42 }
const X_LABELS = 7

function niceNum(range: number, round: boolean) {
  const exponent = Math.floor(Math.log10(range))
  const fraction = range / 10 ** exponent

  let nice: number
  if (round) {
    nice = fraction < 1.5 ? 1 : fraction < 3 ? 2 : fraction < 7 ? 5 : 10
  } else {
    nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10
  }

  return nice * 10 ** exponent
}

function niceTicks(min: number, max: number, tickCount = 6) {
  if (min === max) {
    min -= 1
    max += 1
  }

  const step = niceNum(niceNum(max - min, false) / (tickCount - 1), true)
  const start = Math.floor(min / step) * step
  const end = Math.ceil(max / step) * step

  const ticks: number[] = []
  for (let value = start; value <= end + step / 2; value += step) {
    ticks.push(Number(value.toFixed(6)))
  }

  return { min: start, max: end, ticks }
}

function linearTicks(min: number, max: number, tickCount = 5) {
  const ticks: number[] = []
  for (let i = 0; i < tickCount; i++) {
    ticks.push(min + ((max - min) / (tickCount - 1)) * i)
  }

  return { min, max, ticks }
}

export default function SystemLineChart({
  points,
  color,
  min,
  max,
  threshold,
  area = true,
  className,
}: SystemLineChartProps) {
  const gradientId = useId()

  const plotWidth = WIDTH - PADDING.left - PADDING.right
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom

  const values = points.map((point) => point.value)
  const dataMin = values.length > 0 ? Math.min(...values) : 0
  const dataMax = values.length > 0 ? Math.max(...values) : 1

  const scale =
    min !== undefined && max !== undefined
      ? linearTicks(min, max)
      : niceTicks(Math.min(dataMin, threshold ?? dataMin), Math.max(dataMax, threshold ?? dataMax))

  const yMin = scale.min
  const yMax = scale.max

  const timeMin = points.length > 0 ? points[0].time : 0
  const timeMax = points.length > 0 ? points[points.length - 1].time : 1
  const timeSpan = Math.max(1, timeMax - timeMin)

  const x = (time: number) => PADDING.left + ((time - timeMin) / timeSpan) * plotWidth
  const y = (value: number) =>
    PADDING.top + (1 - (value - yMin) / Math.max(1e-9, yMax - yMin)) * plotHeight

  const linePoints = points.map((point) => `${x(point.time)},${y(point.value)}`)
  const linePath = points.length > 0 ? `M${linePoints.join(' L')}` : ''

  const baseline = y(yMin)
  const areaPath =
    points.length > 0 ? `${linePath} L${x(timeMax)},${baseline} L${x(timeMin)},${baseline} Z` : ''

  const labelEvery = Math.max(1, Math.ceil((points.length - 1) / (X_LABELS - 1)))
  const labelIndices = points
    .map((_, index) => index)
    .filter((index) => index % labelEvery === 0 || index === points.length - 1)

  return (
    <svg
      aria-hidden="true"
      className={className}
      role="presentation"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.35} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>

      {scale.ticks.map((tick) => (
        <g key={tick}>
          <line
            className="text-muted-foreground"
            stroke="currentColor"
            strokeDasharray="3 5"
            strokeOpacity={0.25}
            x1={PADDING.left}
            x2={WIDTH - PADDING.right}
            y1={y(tick)}
            y2={y(tick)}
          />
          <text
            className="text-muted-foreground"
            dominantBaseline="middle"
            fill="currentColor"
            fillOpacity={0.6}
            fontSize={11}
            textAnchor="end"
            x={PADDING.left - 8}
            y={y(tick)}
          >
            {Number(tick.toFixed(2))}
          </text>
        </g>
      ))}

      {threshold !== undefined && (
        <line
          stroke="#f43f5e"
          strokeDasharray="6 4"
          strokeWidth={1.5}
          x1={PADDING.left}
          x2={WIDTH - PADDING.right}
          y1={y(threshold)}
          y2={y(threshold)}
        />
      )}

      {area && points.length > 0 && <path d={areaPath} fill={`url(#${gradientId})`} />}

      {points.length > 0 && (
        <path
          d={linePath}
          fill="none"
          stroke={color}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
        />
      )}

      {labelIndices.map((index) => (
        <text
          key={index}
          className="text-muted-foreground"
          fill="currentColor"
          fillOpacity={0.6}
          fontSize={10}
          textAnchor="middle"
          x={x(points[index].time)}
          y={HEIGHT - 8}
        >
          {formatClock(points[index].time)}
        </text>
      ))}
    </svg>
  )
}
