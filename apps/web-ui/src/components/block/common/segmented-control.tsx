import { cn } from '@/lib/utils'

const SIZE_CLASSES = {
  sm: 'px-2.5 py-1 text-xs',
  md: 'px-3 py-1.5 text-sm',
} as const

interface SegmentedControlProps<T extends string> {
  /** `count` renders a muted tally after the label, e.g. a filter's matches. */
  options: readonly {
    value: T
    label: string
    count?: number
    icon?: React.ElementType
  }[]
  value: T
  onChange: (value: T) => void
  size?: keyof typeof SIZE_CLASSES
  className?: string
  'aria-label'?: string
}

/** Single-select pill group (time ranges, chart metrics, view tabs). */
export default function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  size = 'sm',
  className,
  'aria-label': ariaLabel,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        'inline-flex items-center gap-1 rounded-lg border border-border bg-card p-1',
        className
      )}
    >
      {options.map((option) => {
        const active = option.value === value

        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              'inline-flex cursor-pointer items-center gap-1.5 rounded-md whitespace-nowrap transition-colors',
              SIZE_CLASSES[size],
              active
                ? 'bg-accent font-medium text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {option.icon && <option.icon className="size-3.5 shrink-0" aria-hidden />}
            {option.label}
            {option.count !== undefined && (
              <span className="text-muted-foreground tabular-nums">{option.count}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
