import { IconArrowRight } from '@tabler/icons-react'
import { Link } from '@tanstack/react-router'

import { cn } from '@/lib/utils'

interface SectionCardPanelProps {
  title: React.ReactNode
  /** Muted line under the title. */
  description?: string
  icon: React.ElementType
  /** Link on the right of the header, e.g. "All models" → /usage. */
  action?: { label: string; to: string }
  /** Controls on the right of the header (e.g. a filter), instead of a link. */
  toolbar?: React.ReactNode
  children: React.ReactNode
  className?: string
}

/** Section card used across the app: bordered surface with an icon + title header row. */
export default function SectionCardPanel({
  title,
  description,
  icon: Icon,
  action,
  toolbar,
  children,
  className,
}: SectionCardPanelProps) {
  return (
    <section
      className={cn(
        'flex min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card',
        className
      )}
    >
      <header
        className={cn(
          'flex flex-wrap items-center justify-between gap-3 border-b border-border px-4',
          toolbar ? 'py-2' : 'py-3'
        )}
      >
        <div className="flex items-center gap-2.5">
          <Icon className="text-primary size-4 shrink-0" stroke={1.75} aria-hidden />
          <div>
            <h2 className="flex items-center gap-2 text-[13px] font-semibold text-foreground">
              {title}
            </h2>
            {description && <p className="text-xs text-muted-foreground">{description}</p>}
          </div>
        </div>
        {action && <PanelLink {...action} />}
        {toolbar}
      </header>
      {children}
    </section>
  )
}

/** Small "Label →" link used in panel headers and sub-sections. */
export function PanelLink({ label, to }: { label: string; to: string }) {
  return (
    <Link
      to={to}
      className="text-primary inline-flex h-6 items-center gap-1 rounded-sm text-xs font-medium hover:underline"
    >
      {label}
      <IconArrowRight className="size-3.5" aria-hidden />
    </Link>
  )
}
