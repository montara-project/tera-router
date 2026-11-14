import { IconAlertTriangle, IconBattery1, IconGauge, IconHistory } from '@tabler/icons-react'

import type { Models } from '@/lib/api/models'

interface QuotaStatCard {
  label: string
  icon: React.ElementType
  value: string
  /** Small figure under the value (e.g. "of 9 accounts"). */
  detail?: string
}

export const TEAL_CHIP = 'bg-teal-500/10 text-teal-600 dark:bg-teal-400/10 dark:text-teal-300'

/**
 * Header strip of the quota page: one tile per account-health figure, joined
 * by hairline gaps (the project's stat-card idiom).
 */
export default function QuotaStatStrip({ summary }: { summary: Models.QuotaSummary }) {
  // Attention/depleted only mean something when upstream windows exist; with
  // usage-only accounts every figure stays 0 and next reset stays unknown.

  const cards: QuotaStatCard[] = [
    {
      label: 'Needs attention',
      icon: IconAlertTriangle,
      value: String(summary.attention),
      detail: `of ${summary.total_accounts} accounts`,
    },
    {
      label: 'Near limit',
      icon: IconGauge,
      value: String(summary.near_limit),
      detail: '80%+ of a window used',
    },
    {
      label: 'Exhausted',
      icon: IconBattery1,
      value: String(summary.depleted),
    },
    {
      label: 'Next reset',
      icon: IconHistory,
      value: '—',
    },
  ]

  return (
    <dl className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <div key={card.label} className="bg-card relative flex flex-col gap-0.5 py-3.5 pr-4 pl-15">
          <span
            className={`absolute top-3.5 left-4 flex size-8 items-center justify-center rounded-md ${TEAL_CHIP}`}
          >
            <card.icon className="size-4" stroke={1.75} aria-hidden />
          </span>
          <dt className="text-muted-foreground text-xs font-medium">{card.label}</dt>
          <dd className="text-foreground text-xl font-semibold tracking-[-0.01em] tabular-nums">
            {card.value}
          </dd>
          <dd className="text-muted-foreground min-h-5 text-xs">{card.detail}</dd>
        </div>
      ))}
    </dl>
  )
}
