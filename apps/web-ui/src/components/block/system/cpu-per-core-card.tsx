import { IconCpu } from '@tabler/icons-react'

import type { SystemCore } from '@/lib/api/models/system'

import DashboardPanel from '@/components/block/dashboard/dashboard-panel'
import { cn } from '@/lib/utils'

const LOAD_LEGEND = [
  { label: 'Idle', color: 'bg-zinc-500' },
  { label: '20–60%', color: 'bg-emerald-500' },
  { label: '60–85%', color: 'bg-amber-500' },
  { label: '85%+', color: 'bg-red-500' },
]

function coreColor(percent: number) {
  if (percent < 20) return 'bg-zinc-500'
  if (percent < 60) return 'bg-emerald-500'
  if (percent < 85) return 'bg-amber-500'
  return 'bg-red-500'
}

export default function CpuPerCoreCard({ cores }: { cores: SystemCore[] }) {
  const activeCores = cores.filter((core) => core.percent >= 20).length
  const averageUsage = cores.length
    ? cores.reduce((total, core) => total + core.percent, 0) / cores.length
    : 0

  return (
    <DashboardPanel
      icon={IconCpu}
      title="CPU per core"
      description={`${activeCores} of ${cores.length} cores active · ${averageUsage.toFixed(1)}% average`}
    >
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-x-6 gap-y-4 p-4">
        {cores.map((core) => {
          const percent = Math.min(100, Math.max(0, core.percent))
          return (
            <li key={core.id} className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs text-muted-foreground">Core {core.id}</span>
                <span className="font-mono text-xs text-foreground tabular-nums">
                  {percent.toFixed(0)}%
                </span>
              </div>
              <div
                className="h-1.5 overflow-hidden rounded-sm bg-muted"
                role="progressbar"
                aria-label={`Core ${core.id} utilization`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(percent)}
              >
                <div
                  className={cn(
                    'h-full rounded-sm transition-[width] duration-500',
                    coreColor(core.percent)
                  )}
                  style={{ width: `${percent}%` }}
                />
              </div>
            </li>
          )
        })}
      </ul>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-border bg-muted/30 px-4 py-2.5">
        {LOAD_LEGEND.map((legend) => (
          <span
            key={legend.label}
            className="flex items-center gap-1.5 text-xs text-muted-foreground"
          >
            <span className={cn('size-2 rounded-full', legend.color)} />
            {legend.label}
          </span>
        ))}
      </div>
    </DashboardPanel>
  )
}
