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
    { label: 'Heap Alloc', value: formatMb(runtime.heap_alloc_mb) },
    { label: 'Heap Sys', value: formatMb(runtime.heap_sys_mb) },
    { label: 'Heap In-Use', value: formatMb(runtime.heap_in_use_mb) },
    { label: 'Heap Idle', value: formatMb(runtime.heap_idle_mb) },
    { label: 'GC Cycles', value: formatCount(runtime.gc_cycles) },
    {
      label: 'GC Pause (total)',
      value: `${runtime.gc_pause_total_ms.toLocaleString('en-US', {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      })} ms`,
    },
    { label: 'GC Pause (last)', value: `${runtime.gc_pause_last_ms.toFixed(2)} ms` },
    { label: 'Network Conns', value: process.network_connections },
    { label: 'Process FDs', value: process.open_fds },
    { label: 'Process Threads', value: process.threads },
  ]

  return (
    <Card className="bg-background">
      <CardHeader className="h-20">
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
