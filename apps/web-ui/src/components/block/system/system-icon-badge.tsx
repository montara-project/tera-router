import type { LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

export type SystemTone = 'amber' | 'cyan' | 'emerald' | 'orange'

const toneClasses: Record<SystemTone, string> = {
  emerald:
    'bg-emerald-50 text-emerald-600 ring-emerald-200/70 dark:bg-emerald-950/30 dark:text-emerald-300 dark:ring-emerald-900/60',
  amber:
    'bg-amber-50 text-amber-700 ring-amber-200/70 dark:bg-amber-950/30 dark:text-amber-300 dark:ring-amber-900/60',
  orange:
    'bg-orange-50 text-orange-600 ring-orange-200/70 dark:bg-orange-950/30 dark:text-orange-300 dark:ring-orange-900/60',
  cyan: 'bg-cyan-50 text-cyan-600 ring-cyan-200/70 dark:bg-cyan-950/30 dark:text-cyan-300 dark:ring-cyan-900/60',
}

interface SystemIconBadgeProps {
  icon: LucideIcon
  tone: SystemTone
  className?: string
  iconClassName?: string
}

export default function SystemIconBadge({
  icon: Icon,
  tone,
  className,
  iconClassName,
}: SystemIconBadgeProps) {
  return (
    <span
      className={cn(
        'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1',
        toneClasses[tone],
        className
      )}
    >
      <Icon className={cn('h-4 w-4', iconClassName)} />
    </span>
  )
}
