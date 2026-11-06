import { IconStack2 } from '@tabler/icons-react'

import type { Models } from '@/lib/api/models'

import SectionCardPanel from '@/components/block/common/section-card-panel'
import { formatCount, formatMb } from '@/lib/format'

import StatsGrid from './stats-grid'

interface GoRuntimeCardProps {
  runtime: Models.SystemStats['runtime']
  process: Models.SystemStats['process']
}

export default function GoRuntimeCard({ runtime, process }: GoRuntimeCardProps) {
  const items = [
    { label: 'Heap alloc', value: formatMb(runtime.heap_alloc_mb) },
    { label: 'Heap sys', value: formatMb(runtime.heap_sys_mb) },
    { label: 'Heap in use', value: formatMb(runtime.heap_in_use_mb) },
    { label: 'Heap idle', value: formatMb(runtime.heap_idle_mb) },
    { label: 'GC cycles', value: formatCount(runtime.gc_cycles) },
    {
      label: 'GC pause (total)',
      value: `${runtime.gc_pause_total_ms.toLocaleString('en-US', {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      })} ms`,
    },
    { label: 'GC pause (last)', value: `${runtime.gc_pause_last_ms.toFixed(2)} ms` },
    { label: 'Network connections', value: process.network_connections },
    { label: 'Open FDs', value: process.open_fds },
    { label: 'Threads', value: process.threads },
  ]

  return (
    <SectionCardPanel icon={IconStack2} title="Go runtime" description="Memory and GC statistics">
      <StatsGrid items={items} />
    </SectionCardPanel>
  )
}
