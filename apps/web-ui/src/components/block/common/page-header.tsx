import { cn } from '@/lib/utils'

interface PageHeaderProps {
  title: string
  description?: React.ReactNode
  /** Icon shown in the neutral tile left of the title. */
  icon?: React.ElementType
  /** Page-level buttons, right-aligned (e.g. Rescan, New …). */
  actions?: React.ReactNode
  className?: string
}

/** Top of a page: icon tile, title, one-line description and actions. */
export default function PageHeader({
  title,
  description,
  icon: Icon,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn('flex flex-wrap items-start justify-between gap-4', className)}>
      <div className="flex min-w-0 items-center gap-3">
        {Icon && (
          <span className="text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/40">
            <Icon className="size-5" />
          </span>
        )}
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold tracking-tight text-foreground">{title}</h1>
          {description && <p className="text-muted-foreground text-sm">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
