import type { ReactNode } from 'react'

import StatRow from './stat-row'

interface StatsGridItem {
  label: string
  value: ReactNode
}

/** Label/value rows in two columns split by a divider, one column on small screens. */
export default function StatsGrid({ items }: { items: StatsGridItem[] }) {
  return (
    <div className="grid gap-x-8 px-4 py-2 sm:grid-cols-2">
      {items.map((item) => (
        <StatRow key={item.label} label={item.label} value={item.value} />
      ))}
    </div>
  )
}
