import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

interface SystemProgressProps {
  label: string
  percent: number
  sublabel?: ReactNode
  className?: string
}

function loadColor(percent: number) {
  if (percent >= 85) return 'bg-red-500'
  if (percent >= 60) return 'bg-amber-500'
  return 'bg-emerald-500'
}

export default function SystemProgress({
  label,
  percent,
  sublabel,
  className,
}: SystemProgressProps) {
  const value = Math.min(100, Math.max(0, percent))

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-[12.5px] font-medium text-foreground">{label}</span>
        <span className="font-mono text-xs text-foreground tabular-nums">
          {percent.toFixed(1)}%
        </span>
      </div>
      <div
        className="h-1.5 overflow-hidden rounded-sm bg-muted"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(value)}
      >
        <div
          className={cn('h-full rounded-sm transition-[width] duration-500', loadColor(percent))}
          style={{ width: `${value}%` }}
        />
      </div>
      {sublabel && <div className="text-xs text-muted-foreground">{sublabel}</div>}
    </div>
  )
}
