import type { LucideIcon } from 'lucide-react'

import { Card } from '@/components/ui/card'

import QuotaIconBadge, { type QuotaBadgeShape, type QuotaBadgeTone } from './quota-icon-badge'

interface QuotaSummaryStat {
  value: string | number
  label: string
}

interface QuotaSummaryCardProps {
  icon: LucideIcon
  iconTone: QuotaBadgeTone
  iconShape?: QuotaBadgeShape
  label: string
  value: string | number
  valueLabel: string
  stats: QuotaSummaryStat[]
}

export default function QuotaSummaryCard({
  icon,
  iconTone,
  iconShape = 'square',
  label,
  value,
  valueLabel,
  stats,
}: QuotaSummaryCardProps) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-3">
        <QuotaIconBadge icon={icon} shape={iconShape} tone={iconTone} />
        <span className="text-muted-foreground text-xs font-semibold tracking-[0.14em] uppercase">
          {label}
        </span>
      </div>

      <div className="mt-4 flex items-baseline gap-2">
        <span className="text-3xl font-semibold tracking-tight tabular-nums">{value}</span>
        <span className="text-muted-foreground text-sm">{valueLabel}</span>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3 border-t border-border pt-3">
        {stats.map((stat) => (
          <div key={stat.label} className="min-w-0">
            <div className="text-sm font-semibold tabular-nums">{stat.value}</div>
            <div className="text-muted-foreground mt-0.5 text-[9px] font-medium tracking-wider uppercase">
              {stat.label}
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}
