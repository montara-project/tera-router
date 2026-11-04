import { IconArrowRight } from '@tabler/icons-react'
import { Link } from '@tanstack/react-router'

import { cn } from '@/lib/utils'

interface DashboardPanelProps {
  title: string
  icon: React.ElementType
  /** Link on the right of the header, e.g. "All models" → /usage. */
  action?: { label: string; to: string }
  children: React.ReactNode
  className?: string
}

/** Overview panel: bordered surface with an icon + title header row. */
export default function DashboardPanel({
  title,
  icon: Icon,
  action,
  children,
  className,
}: DashboardPanelProps) {
  return (
    <section
      className={cn(
        'flex min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card',
        className
      )}
    >
      <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <h2 className="flex items-center gap-2.5 text-[13px] font-semibold text-foreground">
          <Icon className="text-primary size-4" stroke={1.75} aria-hidden />
          {title}
        </h2>
        {action && <PanelLink {...action} />}
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
