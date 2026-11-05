import { IconActivity, IconChartBar, IconCircleCheck, IconClock } from '@tabler/icons-react'
import { Link } from '@tanstack/react-router'

import type { Models } from '@/lib/api/models'

import { HealthTimeline } from '@/components/block/dashboard/overview-provider-health'
import { formatCount, formatMs } from '@/lib/format'

export function Stat({
  icon: Icon,
  label,
  children,
  action,
}: {
  icon: React.ElementType
  label: string
  children: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div className="flex gap-3 bg-card px-4 py-3.5">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Icon className="size-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <dt className="flex items-center justify-between gap-2 text-xs font-medium text-muted-foreground">
          {label}
          {action}
        </dt>
        <dd className="mt-0.5">{children}</dd>
      </div>
    </div>
  )
}

/** Last-24h figures for one provider, from the provider health overview. */
export default function ProviderStatStrip({ health }: { health?: Models.HealthEntry }) {
  const traffic = health && health.requests > 0 ? health : undefined
  const figure = (value: string) => (
    <span className="text-xl font-semibold tabular-nums">{traffic ? value : '—'}</span>
  )

  return (
    <dl className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
      <Stat icon={IconChartBar} label="Requests · 24h">
        {figure(formatCount(traffic?.requests ?? 0))}
      </Stat>
      <Stat icon={IconCircleCheck} label="Success">
        {figure(`${(traffic?.successRate ?? 0).toFixed(1)}%`)}
      </Stat>
      <Stat icon={IconClock} label="p95 latency">
        {figure(traffic && traffic.p95Ms > 0 ? formatMs(traffic.p95Ms) : '—')}
      </Stat>
      <Stat
        icon={IconActivity}
        label="Hourly health"
        action={
          <Link
            to="/provider-health"
            className="text-primary rounded-sm text-xs font-medium hover:underline"
          >
            Details
          </Link>
        }
      >
        {traffic ? (
          <HealthTimeline entry={traffic} className="mt-1.5 gap-[2px] [&>li]:h-3" />
        ) : (
          <span className="text-[13px] text-muted-foreground">No traffic yet</span>
        )}
      </Stat>
    </dl>
  )
}
