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
      <CardHeader>
        <div className="flex items-center gap-3.5">
          <SystemIconBadge icon={icon} tone={tone} className="h-10 w-10" iconClassName="h-5 w-5" />
          <CardHeading>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeading>
        </div>
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
