import { IconBarrierBlock } from '@tabler/icons-react'

import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  title: string
  description?: string
  icon?: typeof IconBarrierBlock
  /** CTA rendered under the header — e.g. a "Clear search" or "New …" button. */
  action?: React.ReactNode
  className?: string
}

/**
 * List-level empty state — the icon/title/description shell every list page
 * repeats (no results, no items yet). Unlike EmptySection, it carries no
 * navigation: callers own the action button.
 */
export default function EmptyState({
  title,
  description,
  icon: Icon = IconBarrierBlock,
  action,
  className,
}: EmptyStateProps) {
  return (
    <Empty className={cn('py-14', className)}>
      <EmptyHeader>
        <EmptyMedia variant="icon" className="size-12 rounded-full">
          <Icon />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        {description ? <EmptyDescription>{description}</EmptyDescription> : null}
      </EmptyHeader>
      {action}
    </Empty>
  )
}
