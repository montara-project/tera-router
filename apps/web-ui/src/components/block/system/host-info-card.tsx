import { Globe } from 'lucide-react'

import type { Models } from '@/lib/api/models'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardHeading,
  CardTitle,
} from '@/components/ui/card'

import { formatGb, formatMb, formatUptime } from './formatters'
import StatsGrid from './stats-grid'
import SystemIconBadge from './system-icon-badge'

interface HostInfoCardProps {
  host: Models.SystemStats['host']
  process: Models.SystemStats['process']
}

export default function HostInfoCard({ host, process }: HostInfoCardProps) {
  const items = [
    { label: 'Hostname', value: host.hostname },
    { label: 'OS', value: host.os },
    { label: 'Architecture', value: host.architecture },
    { label: 'PID', value: process.pid },
    { label: 'Uptime', value: formatUptime(host.uptimeSeconds) },
    { label: 'Memory Available', value: formatMb(host.memoryAvailableMb) },
    { label: 'Disk Free', value: formatGb(host.diskFreeGb) },
  ]

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3.5">
          <SystemIconBadge
            icon={Globe}
            tone="amber"
            className="h-10 w-10"
            iconClassName="h-5 w-5"
          />
          <CardHeading>
            <CardTitle>Host Info</CardTitle>
            <CardDescription>System and process details</CardDescription>
          </CardHeading>
        </div>
      </CardHeader>

      <CardContent>
        <StatsGrid items={items} />
      </CardContent>
    </Card>
  )
}
