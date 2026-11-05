import type { ReactNode } from 'react'

import { IconServer } from '@tabler/icons-react'

import type { Models } from '@/lib/api/models'

import DashboardPanel from '@/components/block/dashboard/dashboard-panel'
import { formatDuration } from '@/lib/date'
import { formatCount, formatMb } from '@/lib/format'

import StatRow from './stat-row'
import SystemProgress from './system-progress'

function ColumnLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-[11.5px] font-medium tracking-wide text-muted-foreground uppercase">
      {children}
    </p>
  )
}

export default function SystemOverviewCard({ stats }: { stats: Models.SystemStats }) {
  const { host, process } = stats

  return (
    <DashboardPanel
      icon={IconServer}
      title="System overview"
      description="Host and process resource usage"
    >
      <div className="grid divide-y divide-border sm:grid-cols-2 sm:divide-x sm:divide-y-0">
        <div className="flex flex-col gap-4 p-4">
          <ColumnLabel>Host</ColumnLabel>
          <SystemProgress
            label="CPU"
            percent={host.cpu_percent}
            sublabel={`${host.cpu_cores} cores`}
          />
          <SystemProgress
            label="Memory"
            percent={host.memory_percent}
            sublabel={`${formatCount(host.memory_used_mb)} / ${formatCount(host.memory_total_mb)} MB`}
          />
          <SystemProgress
            label="Disk"
            percent={host.disk_percent}
            sublabel={`${host.disk_used_gb.toFixed(1)} / ${host.disk_total_gb.toFixed(1)} GB`}
          />
          <StatRow label="Network connections" value={process.network_connections} />
        </div>

        <div className="flex flex-col gap-4 p-4">
          <ColumnLabel>Process · PID {process.pid}</ColumnLabel>
          <SystemProgress
            label="CPU"
            percent={process.cpu_percent}
            sublabel={`Uptime ${formatDuration(host.uptime_seconds)}`}
          />
          <SystemProgress
            label="RSS"
            percent={process.rss_percent}
            sublabel={formatMb(process.rss_mb)}
          />
          <div>
            <StatRow label="Goroutines" value={process.goroutines} />
            <StatRow label="Threads" value={process.threads} />
            <StatRow label="Open FDs" value={process.open_fds} />
          </div>
        </div>
      </div>
    </DashboardPanel>
  )
}
