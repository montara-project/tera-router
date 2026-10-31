import { useQuery } from '@tanstack/react-query'

import { Skeleton } from '@/components/ui/skeleton'
import { queries } from '@/lib/api/queries'
import { formatUptime } from '@/lib/date'
import { cn } from '@/lib/utils'

/** Sidebar footer card: gateway liveness, process uptime, listen address, database. */
export default function GatewayStatus() {
  const { data, isLoading, isError } = useQuery(queries.system.status())

  if (isLoading) {
    return <Skeleton className="h-14 w-full rounded-lg group-data-[collapsible=icon]:hidden" />
  }

  const running = !isError && data?.status === 'running'

  return (
    <div className="rounded-lg border border-sidebar-border bg-sidebar-accent/40 px-3 py-2.5 text-xs group-data-[collapsible=icon]:hidden">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 font-medium text-sidebar-foreground">
          <span
            className={cn('size-1.5 rounded-full', running ? 'bg-emerald-500' : 'bg-destructive')}
          />
          {running ? 'Gateway running' : 'Gateway unreachable'}
        </span>
        {running && data && (
          <span className="text-muted-foreground tabular-nums">
            Up {formatUptime(data.uptime_seconds)}
          </span>
        )}
      </div>
      {running && data && (
        <div className="text-muted-foreground mt-1 flex items-center justify-between gap-2 font-mono text-[11px]">
          <span className="truncate">{data.listen_addr}</span>
          <span>{data.database}</span>
        </div>
      )}
    </div>
  )
}
