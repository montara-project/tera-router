import { IconActivity } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'

import type { HealthEntry, HealthStatus, HealthWindow } from '@/lib/api/models/provider-health'
import type { UsageRange } from '@/lib/api/models/usage'

import SectionCardPanel from '@/components/block/common/section-card-panel'
import { ProviderAvatar } from '@/components/block/providers/provider-avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { queries } from '@/lib/api/queries'
import { formatCount, formatMs } from '@/lib/format'
import { cn } from '@/lib/utils'

const STATUS: Record<HealthStatus, { label: string; className: string; dot: string }> = {
  healthy: {
    label: 'Healthy',
    className: 'bg-emerald-500/10 text-emerald-700 ring-emerald-500/25 dark:text-emerald-400',
    dot: 'bg-emerald-500',
  },
  degraded: {
    label: 'Degraded',
    className: 'bg-amber-500/10 text-amber-800 ring-amber-500/25 dark:text-amber-400',
    dot: 'bg-amber-500',
  },
  down: {
    label: 'Unhealthy',
    className: 'bg-destructive/10 text-red-700 ring-destructive/25 dark:text-red-400',
    dot: 'bg-destructive',
  },
}

/** Provider health pill: dot + label, tinted by status. */
export function HealthBadge({ status }: { status: HealthStatus }) {
  const s = STATUS[status]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-sm px-1.5 py-0.5 text-[11px] leading-4 font-medium whitespace-nowrap ring-1 ring-inset',
        s.className
      )}
    >
      <span className={cn('size-1.5 rounded-full', s.dot)} aria-hidden />
      {s.label}
    </span>
  )
}

/** Timeline cell fill: empty, all ok, some failed, all failed. */
function cellClass(bucket: HealthEntry['buckets'][number]) {
  if (bucket.requests === 0) return 'bg-muted'
  if (bucket.failed === 0) return 'bg-emerald-500/70'
  if (bucket.failed < bucket.requests) return 'bg-amber-500/80'
  return 'bg-destructive/80'
}

/**
 * 24 cells, oldest first, coloured by outcome; each has a text label. The
 * cells are hourly for the default 24h window; pass `span` for others.
 */
export function HealthTimeline({
  entry,
  className,
  span,
}: {
  entry: HealthEntry
  className?: string
  /** e.g. "7d"; omit for the hourly 24h strip */
  span?: string
}) {
  return (
    <ol
      className={cn('grid grid-cols-24 gap-[3px]', className)}
      aria-label={`${entry.name}, outcomes over the last ${span ?? '24 hours'}`}
    >
      {entry.buckets.map((b, i) => {
        const when = span ? `Slice ${i + 1} of 24` : `${24 - i}h ago`
        return (
          <li
            key={i}
            className={cn('h-3.5 rounded-[2px]', cellClass(b))}
            title={`${when}: ${b.requests} requests, ${b.failed} failed`}
          >
            <span className="sr-only">
              {when}: {b.requests} requests, {b.failed} failed
            </span>
          </li>
        )
      })}
    </ol>
  )
}

const SPANS: Record<HealthWindow, string> = {
  '5m': '5 minutes',
  '15m': '15 minutes',
  '1h': 'hour',
  '6h': '6 hours',
  '24h': '24 hours',
  '7d': '7 days',
  '30d': '30 days',
  '90d': '90 days',
}

/** Health over the dashboard's time range; "today" reads as the last 24h. */
export default function OverviewProviderHealth({ range }: { range: UsageRange }) {
  const window: HealthWindow = range === 'today' ? '24h' : range
  const span = SPANS[window]
  const { data, isLoading } = useQuery(queries.providerHealth.overview(window))
  const providers = (data?.providers ?? [])
    .filter((p) => p.requests > 0)
    // Busiest provider first; each row's badge still flags a degraded or down one.
    .sort((a, b) => b.requests - a.requests)

  return (
    <SectionCardPanel
      title={`Provider health ${window}`}
      icon={IconActivity}
      action={{ label: 'All providers', to: '/provider-health' }}
    >
      {/* Five providers fit: a row is 62px (40px name and status lines, 8px gap, 14px
          timeline), plus four 20px gaps and 16px padding top and bottom. The traffic chart
          beside it stretches to the same height. */}
      <div className="scrollbar-seamless flex max-h-[calc(5*62px+4*20px+32px)] flex-col gap-5 overflow-y-auto overscroll-contain p-4">
        {isLoading && <Skeleton className="h-14 w-full rounded-md" />}
        {!isLoading && providers.length === 0 && (
          <p className="text-muted-foreground text-sm">No provider traffic in the last {span}.</p>
        )}
        {providers.map((p) => {
          return (
            <div key={p.id} className="flex flex-col gap-2">
              <div className="flex items-start justify-between gap-3">
                <span className="flex min-w-0 items-center gap-2.5">
                  <ProviderAvatar slug={p.id} size="xs" />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-[13px] leading-5 font-medium" title={p.name}>
                      {p.name}
                    </span>
                    <span className="text-muted-foreground truncate text-[11px] leading-4 tabular-nums">
                      {formatCount(p.requests)} {p.requests === 1 ? 'request' : 'requests'}
                    </span>
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  <HealthBadge status={p.status} />
                  <span className="text-muted-foreground text-[11px] leading-4 tabular-nums">
                    {p.successRate.toFixed(1)}% ok · p95 {formatMs(p.p95Ms)}
                  </span>
                </span>
              </div>
              <HealthTimeline entry={p} span={window === '24h' ? undefined : span} />
            </div>
          )
        })}
      </div>
    </SectionCardPanel>
  )
}
