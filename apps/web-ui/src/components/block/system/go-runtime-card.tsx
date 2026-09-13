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
      <CardHeader className="border-b-0 pb-1">
        <CardHeading className="flex flex-row items-center gap-3 space-y-0">
          <SystemIconBadge icon={Layers} tone="emerald" />
          <div className="space-y-0.5">
            <CardTitle className="text-base">Go Runtime</CardTitle>
            <CardDescription className="text-sm">Memory and GC statistics</CardDescription>
          </div>
        </CardHeading>
      </CardHeader>

      <CardContent>
        <StatsGrid items={items} />
      </CardContent>
    </Card>
  )
}
