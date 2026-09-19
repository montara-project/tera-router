import { IconActivity, IconBan, IconFilter, IconKey } from '@tabler/icons-react'

import type { Models } from '@/lib/api/models'

import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

type StatTone = 'amber' | 'rose'

const toneClasses: Record<StatTone, string> = {
  amber: 'text-amber-500 dark:text-amber-400',
  rose: 'text-rose-500 dark:text-rose-400',
}

interface KeysStatsStripProps {
  keys: Models.ApiKey[]
}

export default function KeysStatsStrip({ keys }: KeysStatsStripProps) {
  const stats = [
    { label: 'Total keys', value: keys.length, icon: IconKey, tone: 'amber' as StatTone },
    {
      label: 'Active',
      value: keys.filter((key) => key.status === 'active').length,
      icon: IconActivity,
      tone: 'amber' as StatTone,
    },
    {
      label: 'Disabled',
      value: keys.filter((key) => key.status === 'disabled').length,
      icon: IconBan,
      tone: 'rose' as StatTone,
    },
    {
      label: 'Restricted',
      value: keys.filter((key) => key.status === 'restricted').length,
      icon: IconFilter,
      tone: 'amber' as StatTone,
    },
  ]

  return (
    <Card className="p-0">
      <div className="grid grid-cols-2 lg:grid-cols-4 lg:divide-x lg:divide-border">
        {stats.map((stat) => (
          <div key={stat.label} className="flex flex-col gap-3 p-5">
            <div className="flex items-center gap-2">
              <stat.icon className={cn('h-4 w-4', toneClasses[stat.tone])} />
              <span className="text-muted-foreground text-xs font-medium tracking-[0.14em] uppercase">
                {stat.label}
              </span>
            </div>
            <span className="text-2xl font-semibold tracking-tight tabular-nums">{stat.value}</span>
          </div>
        ))}
      </div>
    </Card>
  )
}
