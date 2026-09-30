import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

import StatRow from './stat-row'

interface StatsGridItem {
  label: string
  value: ReactNode
}

interface StatsGridProps {
  items: StatsGridItem[]
  className?: string
}

/**
 * Two-column label/value grid with a vertical divider between the columns,
 * collapsing to a single column on small screens.
 */
export default function StatsGrid({ items, className }: StatsGridProps) {
  return (
    <div className={cn('grid sm:grid-cols-2', className)}>
      {items.map((item, index) => (
        <StatRow
          key={item.label}
          label={item.label}
          value={item.value}
          className={cn(
            'sm:pr-8',
            index % 2 === 0 && 'sm:border-r sm:border-border',
            index % 2 === 1 && 'sm:pl-8'
          )}
        />
      ))}
    </div>
  )
}
