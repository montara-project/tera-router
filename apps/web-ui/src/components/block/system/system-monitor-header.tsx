import { Activity, RefreshCw } from 'lucide-react'

import { Button } from '@/components/ui/button'

import SystemIconBadge from './system-icon-badge'

interface SystemMonitorHeaderProps {
  onRefresh: () => void
  refreshing?: boolean
}

export default function SystemMonitorHeader({
  onRefresh,
  refreshing = false,
}: SystemMonitorHeaderProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        <SystemIconBadge
          className="h-12 w-12 rounded-xl"
          icon={Activity}
          iconClassName="h-6 w-6"
          tone="emerald"
        />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">System Monitor</h1>
          <p className="text-muted-foreground text-sm">
            Real-time resource usage and runtime health
          </p>
        </div>
      </div>

      <Button disabled={refreshing} onClick={onRefresh} radius="full" variant="outline">
        <RefreshCw className={refreshing ? 'animate-spin' : undefined} />
        Refresh
      </Button>
    </div>
  )
}
