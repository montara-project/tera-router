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
      <CardHeader className="border-b-0 pb-1">
        <CardHeading className="flex flex-row items-center gap-3 space-y-0">
          <SystemIconBadge icon={Globe} tone="amber" />
          <div className="space-y-0.5">
            <CardTitle className="text-base">Host Info</CardTitle>
            <CardDescription className="text-sm">System and process details</CardDescription>
          </div>
        </CardHeading>
      </CardHeader>

      <CardContent>
        <StatsGrid items={items} />
      </CardContent>
    </Card>
  )
}
