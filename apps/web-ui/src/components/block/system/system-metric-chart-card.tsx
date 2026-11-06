import { type TablerIcon } from '@tabler/icons-react'

import type { SystemPoint } from '@/lib/api/models/system'

import SectionCardPanel from '@/components/block/common/section-card-panel'

import SystemLineChart from './system-line-chart'

interface SystemMetricChartCardProps {
  icon: TablerIcon
  title: string
  description: string
  points: SystemPoint[]
  color: string
  /** Formats the latest point for the header, e.g. "42.1%". */
  format: (value: number) => string
  min?: number
  max?: number
  threshold?: number
}

export default function SystemMetricChartCard({
  icon,
  title,
  description,
  points,
  color,
  format,
  min,
  max,
  threshold,
}: SystemMetricChartCardProps) {
  const latest = points.at(-1)?.value

  return (
    <SectionCardPanel
      icon={icon}
      title={title}
      description={description}
      toolbar={
        latest === undefined ? null : (
          <span className="font-mono text-[15px] font-semibold text-foreground tabular-nums">
            {format(latest)}
          </span>
        )
      }
    >
      <div className="px-3 pt-3 pb-2">
        <SystemLineChart color={color} max={max} min={min} points={points} threshold={threshold} />
      </div>
    </SectionCardPanel>
  )
}
