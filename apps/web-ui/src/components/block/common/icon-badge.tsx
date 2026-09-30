import { cn } from '@/lib/utils'

export type IconBadgeTone = 'emerald'
export type IconBadgeVariant = 'soft' | 'filled'

const toneClasses: Record<IconBadgeVariant, string> = {
  soft: 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200/70 dark:bg-emerald-950/30 dark:text-emerald-300 dark:ring-emerald-900/60',
  filled: 'bg-emerald-600 text-white dark:bg-emerald-600 dark:text-white',
}

interface IconBadgeProps {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
  variant?: IconBadgeVariant
  className?: string
  iconClassName?: string
}

export default function IconBadge({
  icon: Icon,
  variant = 'soft',
  className,
  iconClassName,
}: IconBadgeProps) {
  return (
    <span
      className={cn(
        'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
        toneClasses[variant],
        className
      )}
    >
      <Icon className={cn('h-4 w-4', iconClassName)} />
    </span>
  )
}
