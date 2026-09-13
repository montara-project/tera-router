import type { LucideIcon } from 'lucide-react'

import type { SystemPoint } from '@/lib/api/models/system'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardHeading,
  CardTitle,
} from '@/components/ui/card'

import SystemIconBadge, { type SystemTone } from './system-icon-badge'
import SystemLineChart from './system-line-chart'

interface SystemMetricChartCardProps {
  icon: LucideIcon
  tone: SystemTone
  title: string
  description: string
  points: SystemPoint[]
  color: string
  min?: number
  max?: number
  threshold?: number
  area?: boolean
}

export default function SystemMetricChartCard({
  icon,
  tone,
  title,
  description,
  points,
  color,
  min,
  max,
  threshold,
  area = true,
}: SystemMetricChartCardProps) {
  return (
    <Card>
      <CardHeader className="border-b-0 pb-1">
        <CardHeading className="flex flex-row items-center gap-3 space-y-0">
          <SystemIconBadge icon={icon} tone={tone} />
          <div className="space-y-0.5">
            <CardTitle className="text-base">{title}</CardTitle>
            <CardDescription className="text-sm">{description}</CardDescription>
          </div>
        </CardHeading>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <SystemLineChart
          area={area}
          color={color}
          max={max}
          min={min}
          points={points}
          threshold={threshold}
        />
      </CardContent>
    </Card>
  )
}
