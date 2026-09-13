import { Cpu } from 'lucide-react'

import type { SystemCore } from '@/lib/api/models/system'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardHeading,
  CardTitle,
} from '@/components/ui/card'
import { cn } from '@/lib/utils'

import SystemIconBadge from './system-icon-badge'

interface CpuPerCoreCardProps {
  cores: SystemCore[]
}

const LOAD_LEGEND = [
  { label: 'Idle', max: 20, color: 'bg-zinc-500' },
  { label: '20-60%', max: 60, color: 'bg-emerald-500' },
  { label: '60-85%', max: 85, color: 'bg-amber-500' },
  { label: '85%+', max: Infinity, color: 'bg-rose-500' },
]

function coreColor(percent: number) {
  if (percent < 20) return 'bg-zinc-500'
  if (percent < 60) return 'bg-emerald-500'
  if (percent < 85) return 'bg-amber-500'
  return 'bg-rose-500'
}

export default function CpuPerCoreCard({ cores }: CpuPerCoreCardProps) {
  return (
    <Card>
      <CardHeader className="border-b-0 pb-1">
        <CardHeading className="flex flex-row items-center gap-3 space-y-0">
          <SystemIconBadge icon={Cpu} tone="emerald" />
          <div className="space-y-0.5">
            <CardTitle className="text-base">CPU Per Core</CardTitle>
            <CardDescription className="text-sm">
              Utilization across {cores.length} cores
            </CardDescription>
          </div>
        </CardHeading>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-3">
          {cores.map((core) => (
            <div
              key={core.id}
              className="bg-muted h-2.5 w-44 overflow-hidden rounded-full"
              title={`Core ${core.id}: ${core.percent.toFixed(1)}%`}
            >
              <div
                className={cn(
                  'h-full rounded-full transition-[width] duration-500',
                  coreColor(core.percent)
                )}
                style={{ width: `${Math.min(100, Math.max(0, core.percent))}%` }}
              />
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
          {LOAD_LEGEND.map((legend) => (
            <div
              key={legend.label}
              className="text-muted-foreground flex items-center gap-1.5 text-xs"
            >
              <span className={cn('h-2 w-2 rounded-full', legend.color)} />
              {legend.label}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
