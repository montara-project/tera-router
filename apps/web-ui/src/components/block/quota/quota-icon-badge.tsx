import type { LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

export type QuotaBadgeTone = 'amber' | 'emerald' | 'neutral'
export type QuotaBadgeShape = 'circle' | 'square'
export type QuotaBadgeVariant = 'outline' | 'soft'

const toneClasses: Record<QuotaBadgeTone, { outline: string; soft: string }> = {
  emerald: {
    outline:
      'border-emerald-500/40 text-emerald-600 dark:text-emerald-300 dark:border-emerald-500/40',
    soft: 'bg-emerald-50 text-emerald-600 ring-emerald-200/70 dark:bg-emerald-950/30 dark:text-emerald-300 dark:ring-emerald-900/60',
  },
  amber: {
    outline: 'border-amber-500/40 text-amber-600 dark:text-amber-300 dark:border-amber-500/40',
    soft: 'bg-amber-50 text-amber-600 ring-amber-200/70 dark:bg-amber-950/30 dark:text-amber-300 dark:ring-amber-900/60',
  },
  neutral: {
    outline: 'border-border text-muted-foreground',
    soft: 'bg-zinc-100 text-zinc-600 ring-zinc-200/70 dark:bg-zinc-800/60 dark:text-zinc-300 dark:ring-zinc-700/60',
  },
}

interface QuotaIconBadgeProps {
  icon: LucideIcon
  tone: QuotaBadgeTone
  variant?: QuotaBadgeVariant
  shape?: QuotaBadgeShape
  className?: string
  iconClassName?: string
}

export default function QuotaIconBadge({
  icon: Icon,
  tone,
  variant = 'soft',
  shape = 'square',
  className,
  iconClassName,
}: QuotaIconBadgeProps) {
  return (
    <span
      className={cn(
        'flex h-9 w-9 shrink-0 items-center justify-center',
        shape === 'circle' ? 'rounded-full' : 'rounded-lg',
        variant === 'soft' ? 'ring-1' : 'border',
        toneClasses[tone][variant],
        className
      )}
    >
      <Icon className={cn('h-4 w-4', iconClassName)} />
    </span>
  )
}
