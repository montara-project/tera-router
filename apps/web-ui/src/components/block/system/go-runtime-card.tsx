import { Layers } from 'lucide-react'

import type { Models } from '@/lib/api/models'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardHeading,
  CardTitle,
} from '@/components/ui/card'

import { formatCount, formatMb } from './formatters'
import StatsGrid from './stats-grid'
import SystemIconBadge from './system-icon-badge'

interface GoRuntimeCardProps {
  runtime: Models.SystemStats['runtime']
  process: Models.SystemStats['process']
}

export default function GoRuntimeCard({ runtime, process }: GoRuntimeCardProps) {
  const items = [
    { label: 'Heap Alloc', value: formatMb(runtime.heapAllocMb) },
    { label: 'Heap Sys', value: formatMb(runtime.heapSysMb) },
    { label: 'Heap In-Use', value: formatMb(runtime.heapInUseMb) },
    { label: 'Heap Idle', value: formatMb(runtime.heapIdleMb) },
    { label: 'GC Cycles', value: formatCount(runtime.gcCycles) },
    {
      label: 'GC Pause (total)',
      value: `${runtime.gcPauseTotalMs.toLocaleString('en-US', {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      })} ms`,
    },
    { label: 'GC Pause (last)', value: `${runtime.gcPauseLastMs.toFixed(2)} ms` },
    { label: 'Network Conns', value: process.networkConnections },
    { label: 'Process FDs', value: process.openFds },
    { label: 'Process Threads', value: process.threads },
  ]

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3.5">
          <SystemIconBadge
            icon={Layers}
            tone="emerald"
            className="h-10 w-10"
            iconClassName="h-5 w-5"
          />
          <CardHeading>
            <CardTitle>Go Runtime</CardTitle>
            <CardDescription>Memory and GC statistics</CardDescription>
          </CardHeading>
        </div>
      </CardHeader>

      <CardContent>
        <StatsGrid items={items} />
      </CardContent>
    </Card>
  )
}
