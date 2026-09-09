import type { LucideIcon } from 'lucide-react'

import { Card } from '@/components/ui/card'

type UsageTone = 'accent' | 'success' | 'warning'

interface UsageCardProps {
  icon: LucideIcon
  title: string
  primary: string
  primaryLabel: string
  items: Array<{
    label: string
    value: string
    tone: 'good' | 'danger' | 'neutral'
  }>
  tone: 'accent' | 'success' | 'warning'
}

export default function UsageCard({
  icon: Icon,
  title,
  primary,
  primaryLabel,
  items,
  tone,
}: UsageCardProps) {
  const tones: Record<UsageTone, { icon: string; background: string }> = {
    accent: {
      icon: 'text-rose-600 dark:text-rose-300',
      background: 'bg-rose-50 ring-rose-200/70 dark:bg-rose-950/30 dark:ring-rose-900/60',
    },
    success: {
      icon: 'text-emerald-600 dark:text-emerald-300',
      background:
        'bg-emerald-50 ring-emerald-200/70 dark:bg-emerald-950/30 dark:ring-emerald-900/60',
    },
    warning: {
      icon: 'text-amber-700 dark:text-amber-300',
      background: 'bg-amber-50 ring-amber-200/70 dark:bg-amber-950/30 dark:ring-amber-900/60',
    },
  }

  const colors = tones[tone]

  return (
    <Card className="p-5">
      <div className="flex items-center gap-4">
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 ${colors.background}`}
        >
          <Icon className={`h-4 w-4 ${colors.icon}`} />
        </span>
        <span className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {title}
        </span>
      </div>
      <div className="mt-4 flex items-baseline gap-2">
        <span className="text-3xl font-semibold tracking-tight tabular-nums text-neutral-100">
          {primary}
        </span>
        <span className="text-xs text-muted-foreground tracking-wide">{primaryLabel}</span>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3 border-t border-border pt-3">
        {items.map((item) => (
          <div key={item.label} className="min-w-0">
            <div
              className={`truncate text-xs font-semibold tabular-nums sm:text-sm ${
                item.tone === 'good'
                  ? 'text-emerald-600 dark:text-emerald-300'
                  : item.tone === 'danger'
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-neutral-100'
              }`}
              title={item.value}
            >
              {item.value}
            </div>
            <div className="mt-0.5 text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
              {item.label}
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}
