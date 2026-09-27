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
  const activeCores = cores.filter((core) => core.percent >= 20).length
  const averageUsage = cores.length
    ? cores.reduce((total, core) => total + core.percent, 0) / cores.length
    : 0

  return (
    <Card className='bg-background'>
      <CardHeader className='h-20'>
        <div className="flex items-center gap-3.5">
          <SystemIconBadge
            icon={Cpu}
            tone="emerald"
            className="h-10 w-10"
            iconClassName="h-5 w-5"
          />
          <CardHeading>
            <CardTitle>CPU Per Core</CardTitle>
            <CardDescription>
              {activeCores} of {cores.length} cores active · {averageUsage.toFixed(1)}% average
            </CardDescription>
          </CardHeading>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div
                  className="grid w-full gap-2.5"
                  style={{
                    gridTemplateColumns:
                      'repeat(auto-fit, minmax(max(5.5rem, min(100%, calc((100% - 1.875rem) / 4))), 1fr))',
                  }}
                >
          {cores.map((core) => {
            const percent = Math.min(100, Math.max(0, core.percent))

            return (
              <div
                key={core.id}
                className="group rounded-lg border border-border/70 bg-muted/30 p-2.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:bg-muted/70 hover:shadow-sm focus-within:border-primary/50"
                title={`Core ${core.id}: ${core.percent.toFixed(1)}% utilization`}
                aria-label={`Core ${core.id}, ${core.percent.toFixed(1)}% utilization`}
              >
                <div className="mb-2 flex items-center justify-between gap-1">
                  <span className="text-muted-foreground text-xs font-medium">Core {core.id}</span>
                  <span className="text-sm font-semibold tabular-nums">{percent.toFixed(0)}%</span>
                </div>
                <div
                  className="bg-muted h-2 overflow-hidden rounded-full"
                  role="progressbar"
                  aria-label={`Core ${core.id} utilization`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={percent}
                >
                  <div
                    className={cn(
                      'h-full rounded-full transition-[width,filter] duration-500 group-hover:brightness-110',
                      coreColor(core.percent)
                    )}
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>
            )
          })}
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
