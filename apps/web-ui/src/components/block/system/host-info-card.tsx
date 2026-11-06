import { IconWorld } from '@tabler/icons-react'

import type { Models } from '@/lib/api/models'

import SectionCardPanel from '@/components/block/common/section-card-panel'
import { formatDuration } from '@/lib/date'
import { formatGb, formatMb } from '@/lib/format'

import StatsGrid from './stats-grid'

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
    { label: 'Uptime', value: formatDuration(host.uptime_seconds) },
    { label: 'Memory available', value: formatMb(host.memory_available_mb) },
    { label: 'Disk free', value: formatGb(host.disk_free_gb) },
  ]

  return (
    <SectionCardPanel icon={IconWorld} title="Host info" description="System and process details">
      <StatsGrid items={items} />
    </SectionCardPanel>
  )
}
