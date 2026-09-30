import type { ReactNode } from 'react'

import { Server } from 'lucide-react'

import type { Models } from '@/lib/api/models'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardHeading,
  CardTitle,
} from '@/components/ui/card'
import { formatDuration } from '@/lib/date'

import { formatCount, formatMb } from './formatters'
import StatRow from './stat-row'
import SystemIconBadge from './system-icon-badge'
import SystemProgress from './system-progress'

interface SystemOverviewCardProps {
  stats: Models.SystemStats
}

function ColumnLabel({ children }: { children: ReactNode }) {
  return (
    <div className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
      {children}
    </div>
  )
}

export default function SystemOverviewCard({ stats }: SystemOverviewCardProps) {
  const { host, process } = stats

  return (
    <Card className="bg-background">
      <CardHeader className="h-20">
        <div className="flex items-center gap-3.5">
          <SystemIconBadge
            icon={Server}
            tone="emerald"
            className="h-10 w-10"
            iconClassName="h-5 w-5"
          />
          <CardHeading>
            <CardTitle>System Overview</CardTitle>
            <CardDescription>Host and process resource usage</CardDescription>
          </CardHeading>
        </div>
      </CardHeader>

      <CardContent className="grid gap-6 sm:grid-cols-2 sm:gap-0">
        <div className="space-y-5 sm:pr-8">
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
          <StatRow label="Network Connections" value={process.network_connections} />
        </div>

        <div className="space-y-5 sm:border-l sm:border-border sm:pl-8">
          <ColumnLabel>Process (PID {process.pid})</ColumnLabel>
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
          <StatRow label="Goroutines" value={process.goroutines} />
          <StatRow label="Threads" value={process.threads} />
          <StatRow label="Open FDs" value={process.open_fds} />
        </div>
      </CardContent>
    </Card>
  )
}
