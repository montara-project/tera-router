import { IconAlertTriangle, IconBroadcast, IconDatabase, IconHourglass } from '@tabler/icons-react'

import type { Models } from '@/lib/api/models'

import { Skeleton } from '@/components/ui/skeleton'
import { formatCount } from '@/lib/format'

interface AuditStatCard {
  label: string
  icon: React.ElementType
  value: string
  detail: string
}

/**
 * Header strip of the audit page. OpenTelemetry export and pruning do not
 * exist on the server, so those tiles say so instead of showing a setting.
 */
export default function AuditStatStrip({ stats }: { stats?: Models.AuditStats }) {
  const cards: AuditStatCard[] = [
    {
      label: 'Recorded',
      icon: IconDatabase,
      value: stats ? formatCount(stats.recorded) : '',
      detail: stats ? `${formatCount(stats.recorded_since_start)} since this process started` : '',
    },
    {
      label: 'Lost',
      icon: IconAlertTriangle,
      value: stats ? formatCount(stats.lost) : '',
      detail: 'write errors since this process started',
    },
    {
      label: 'OpenTelemetry export',
      icon: IconBroadcast,
      value: 'Off',
      detail: 'Not available in this build',
    },
    {
      label: 'Retention',
      icon: IconHourglass,
      value: 'Forever',
      detail: 'Audit rows are never pruned',
    },
  ]

  return (
    <dl className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <div key={card.label} className="bg-card relative flex flex-col gap-0.5 py-3.5 pr-4 pl-15">
          <span className="absolute top-3.5 left-4 flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary">
            <card.icon className="size-4" stroke={1.75} aria-hidden />
          </span>
          <dt className="text-muted-foreground text-xs font-medium">{card.label}</dt>
          <dd className="text-foreground text-xl font-semibold tracking-[-0.01em] tabular-nums">
            {card.value || <Skeleton className="my-1 h-5 w-12" />}
          </dd>
          <dd className="text-muted-foreground min-h-5 text-xs">{card.detail}</dd>
        </div>
      ))}
    </dl>
  )
}
