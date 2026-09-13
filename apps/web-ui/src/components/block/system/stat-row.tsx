import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

interface StatRowProps {
  label: string
  value: ReactNode
  className?: string
}

export default function StatRow({ label, value, className }: StatRowProps) {
  return (
    <div className={cn('flex items-baseline justify-between gap-4 py-1.5', className)}>
      <span className="text-muted-foreground text-sm whitespace-nowrap">{label}</span>
      <span className="text-sm font-semibold tabular-nums whitespace-nowrap">{value}</span>
    </div>
  )
}
