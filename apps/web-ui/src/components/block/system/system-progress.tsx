import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

interface SystemProgressProps {
  label: string
  percent: number
  sublabel?: ReactNode
  className?: string
}

function barColor(percent: number) {
  if (percent >= 85) return 'bg-rose-500'
  if (percent >= 60) return 'bg-amber-500'
  return 'bg-emerald-500'
}

export default function SystemProgress({
  label,
  percent,
  sublabel,
  className,
}: SystemProgressProps) {
  const width = `${Math.min(100, Math.max(0, percent))}%`

  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-muted-foreground text-sm">{label}</span>
        <span className="text-sm font-semibold tabular-nums">{percent.toFixed(1)}%</span>
      </div>
      <div className="bg-muted h-1.5 overflow-hidden rounded-full">
        <div
          className={cn('h-full rounded-full transition-[width] duration-500', barColor(percent))}
          style={{ width }}
        />
      </div>
      {sublabel && <div className="text-muted-foreground text-xs">{sublabel}</div>}
    </div>
  )
}
