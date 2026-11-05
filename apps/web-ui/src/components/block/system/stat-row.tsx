import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

interface StatRowProps {
  label: string
  value: ReactNode
  className?: string
}

/** Label on the left, a mono value on the right. */
export default function StatRow({ label, value, className }: StatRowProps) {
  return (
    <div className={cn('flex items-baseline justify-between gap-4 py-2', className)}>
      <span className="text-[12.5px] whitespace-nowrap text-muted-foreground">{label}</span>
      <span className="truncate font-mono text-xs text-foreground tabular-nums">{value}</span>
    </div>
  )
}
