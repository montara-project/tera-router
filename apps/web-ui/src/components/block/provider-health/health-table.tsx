import { IconActivity, IconChevronRight } from '@tabler/icons-react'

import type { HealthEntry, HealthStatus } from '@/lib/api/models/provider-health'

import { Badge, BadgeDot } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

import EmptyState from '../common/empty-state'

const STATUS_META: Record<
  HealthStatus,
  { label: string; variant: 'success' | 'warning' | 'destructive' }
> = {
  healthy: { label: 'Healthy', variant: 'success' },
  degraded: { label: 'Degraded', variant: 'warning' },
  down: { label: 'Down', variant: 'destructive' },
}

const COLUMNS = 'grid grid-cols-[1.5fr_1fr_0.8fr_1fr_1fr_0.9fr_0.4fr] items-center gap-4'
const NUMERIC = 'text-sm tabular-nums text-foreground text-right'

interface HealthTableProps {
  entityLabel: string
  entries: HealthEntry[]
  /** Per-row drill-down; renders the chevron action column when provided. */
  onView?: (name: string) => void
}

export default function HealthTable({ entityLabel, entries, onView }: HealthTableProps) {
  return (
    <Card className="bg-background">
      <CardContent className="overflow-x-auto p-0">
        <div className="min-w-180">
          <div className={`${COLUMNS} border-b border-border px-5 py-3`}>
            <p className="text-muted-foreground text-xs">{entityLabel}</p>
            <p className="text-muted-foreground text-xs">Status</p>
            <p className="text-muted-foreground text-right text-xs">Requests</p>
            <p className="text-muted-foreground text-right text-xs">Fallback Rate</p>
            <p className="text-muted-foreground text-right text-xs">Final Failures</p>
            <p className="text-muted-foreground text-xs">Affected</p>
            <span />
          </div>

          {entries.length === 0 ? (
            <EmptyState
              icon={IconActivity}
              title={`No ${entityLabel.toLowerCase()} entries`}
              description="Health telemetry for this scope will appear here."
            />
          ) : (
            <div className="divide-y divide-border/60">
              {entries.map((entry) => {
                const meta = STATUS_META[entry.status]

                return (
                  <div
                    key={entry.id}
                    className={cn(
                      `${COLUMNS} px-5 py-3.5 transition-colors hover:bg-muted/40`,
                      entry.status === 'down' && 'bg-red-50/50 dark:bg-red-950/10'
                    )}
                  >
                    <p className="truncate text-sm font-medium text-foreground">{entry.name}</p>
                    <div>
                      <Badge variant={meta.variant} appearance="light" size="sm">
                        <BadgeDot />
                        {meta.label}
                      </Badge>
                    </div>
                    <p className={NUMERIC}>{entry.requests}</p>
                    <p className={NUMERIC}>{entry.fallbackRate.toFixed(1)}%</p>
                    <p className={NUMERIC}>{entry.finalFailures}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {entry.affected ?? '—'}
                    </p>
                    <div className="flex justify-end">
                      {onView ? (
                        <button
                          type="button"
                          aria-label={`View ${entry.name}`}
                          onClick={() => onView(entry.name)}
                          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                        >
                          <IconChevronRight className="h-4 w-4" />
                        </button>
                      ) : null}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
