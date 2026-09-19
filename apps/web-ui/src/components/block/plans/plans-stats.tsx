import { IconKey, IconShieldCheck, IconWallet } from '@tabler/icons-react'

import type { Models } from '@/lib/api/models'

import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface PlansStatsProps {
  plans: Models.Plan[]
}

const tileTones = {
  amber:
    'bg-amber-50 text-amber-600 ring-amber-200/70 dark:bg-amber-950/30 dark:text-amber-300 dark:ring-amber-900/60',
  emerald:
    'bg-emerald-50 text-emerald-600 ring-emerald-200/70 dark:bg-emerald-950/30 dark:text-emerald-300 dark:ring-emerald-900/60',
}

export default function PlansStats({ plans }: PlansStatsProps) {
  const keysAssigned = plans.reduce((total, plan) => total + plan.keysAssigned, 0)
  const hardCutoff = plans.filter((plan) => plan.hardCutoff).length
  const advisory = plans.length - hardCutoff

  const stats = [
    {
      label: 'Total plans',
      value: plans.length,
      suffix: plans.length === 1 ? 'template' : 'templates',
      icon: IconWallet,
      tone: 'amber' as const,
    },
    {
      label: 'Keys assigned',
      value: keysAssigned,
      suffix: `across ${plans.length} ${plans.length === 1 ? 'plan' : 'plans'}`,
      icon: IconKey,
      tone: 'emerald' as const,
    },
    {
      label: 'Hard cutoff',
      value: hardCutoff,
      suffix: `${advisory} advisory`,
      icon: IconShieldCheck,
      tone: 'amber' as const,
    },
  ]

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {stats.map((stat) => (
        <Card key={stat.label} className="p-5">
          <div className="flex items-center gap-4">
            <span
              className={cn(
                'flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ring-1',
                tileTones[stat.tone]
              )}
            >
              <stat.icon className="h-5 w-5" />
            </span>
            <div>
              <p className="text-muted-foreground text-xs font-medium tracking-[0.14em] uppercase">
                {stat.label}
              </p>
              <p className="mt-1 flex items-baseline gap-2">
                <span className="text-3xl font-semibold tracking-tight tabular-nums">
                  {stat.value}
                </span>
                <span className="text-muted-foreground text-sm">{stat.suffix}</span>
              </p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}
