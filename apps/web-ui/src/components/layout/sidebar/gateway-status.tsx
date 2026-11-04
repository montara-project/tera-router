import { useQuery } from '@tanstack/react-query'

import { Skeleton } from '@/components/ui/skeleton'
import { queries } from '@/lib/api/queries'
import { formatUptime } from '@/lib/date'
import { cn } from '@/lib/utils'

/** Sidebar footer card: gateway liveness, process uptime, listen address, database. */
export default function GatewayStatus() {
  const { data, isLoading, isError } = useQuery(queries.system.status())

  if (isLoading) {
    return <Skeleton className="h-[57px] w-full rounded-md group-data-[collapsible=icon]:hidden" />
  }

  const running = !isError && data?.status === 'running'

  return (
    <section className="flex flex-col gap-0.5 rounded-md border border-sidebar-border bg-sidebar-accent/40 px-[13px] py-[9px] group-data-[collapsible=icon]:hidden">
      <div className="flex h-[18px] items-center gap-2">
        <span
          className={cn(
            'size-1.5 shrink-0 rounded-full',
            running ? 'bg-emerald-500/80' : 'bg-destructive'
          )}
        />
        <span className="flex-1 truncate text-xs font-medium text-sidebar-foreground">
          {running ? 'Gateway running' : 'Gateway unreachable'}
        </span>
        {running && data && (
          <span className="text-sidebar-foreground/80 text-[11.5px] tabular-nums">
            Up {formatUptime(data.uptime_seconds)}
          </span>
        )}
      </div>
      {running && data && (
        <div className="flex items-center justify-between gap-2 text-[11.5px]">
          <span className="text-sidebar-foreground/80 truncate font-mono">{data.listen_addr}</span>
          <span className="text-sidebar-foreground/80">{data.database}</span>
        </div>
      )}
    </section>
  )
}
