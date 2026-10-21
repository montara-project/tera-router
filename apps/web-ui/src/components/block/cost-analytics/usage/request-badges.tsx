import type { UsageTerminalRequestRow } from '@/lib/api/models/usage'

import { Badge } from '@/components/ui/badge'

const STATUS_BADGES = {
  success: { label: 'Success', variant: 'success' },
  failed: { label: 'Failed', variant: 'destructive' },
  cancelled: { label: 'Cancelled', variant: 'secondary' },
} as const

const USAGE_BADGES = {
  provider: { label: 'Provider usage', variant: 'success' },
  estimate: { label: 'Usage estimate', variant: 'warning' },
  none: { label: 'No usage reported', variant: 'secondary' },
} as const

export function RequestStatusBadge({ status }: { status: UsageTerminalRequestRow['status'] }) {
  const badge = STATUS_BADGES[status]

  return (
    <Badge variant={badge.variant} appearance="light" size="sm">
      {badge.label}
    </Badge>
  )
}

export function RequestUsageBadge({ usage }: { usage: UsageTerminalRequestRow['usage'] }) {
  const badge = USAGE_BADGES[usage]

  return (
    <Badge variant={badge.variant} appearance="light" size="sm">
      {badge.label}
    </Badge>
  )
}
