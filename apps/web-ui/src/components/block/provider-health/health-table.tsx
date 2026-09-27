import { IconActivity, IconArrowRight } from '@tabler/icons-react'

import type { HealthEntry, HealthStatus } from '@/lib/api/models/provider-health'

import { Badge, BadgeDot } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { cn } from '@/lib/utils'

const STATUS_META: Record<
  HealthStatus,
  { label: string; variant: 'success' | 'warning' | 'destructive' }
> = {
  healthy: { label: 'Healthy', variant: 'success' },
  degraded: { label: 'Degraded', variant: 'warning' },
  down: { label: 'Down', variant: 'destructive' },
}

const COLUMNS = 'grid grid-cols-[1.5fr_1fr_0.8fr_1fr_1fr_0.9fr_0.6fr] items-center gap-4'
const NUMERIC = 'text-sm tabular-nums text-foreground text-right'

interface HealthTableProps {
  entityLabel: string
  entries: HealthEntry[]
  onView: (name: string) => void
}

export default function HealthTable({ entityLabel, entries, onView }: HealthTableProps) {
  return (
    <Card className="bg-background">
      <CardContent className="overflow-x-auto p-0">
        <div className="min-w-[720px]">
          <div className={`${COLUMNS} border-b border-border px-5 py-3`}>
            <p className="text-muted-foreground text-xs">{entityLabel}</p>
            <p className="text-muted-foreground text-xs">Status</p>
            <p className="text-muted-foreground text-right text-xs">Requests</p>
            <p className="text-muted-foreground text-right text-xs">Fallback Rate</p>
            <p className="text-muted-foreground text-right text-xs">Final Failures</p>
            <p className="text-muted-foreground text-xs">Affected</p>
            <p className="text-muted-foreground text-right text-xs">Action</p>
          </div>

          {entries.length === 0 ? (
            <Empty className="border-0 py-14">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <IconActivity />
                </EmptyMedia>
                <EmptyTitle>No {entityLabel.toLowerCase()} entries</EmptyTitle>
                <EmptyDescription>
                  Health telemetry for this scope will appear here.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
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
                    <p className="truncate text-sm text-muted-foreground">{entry.affected ?? '—'}</p>
                    <div className="text-right">
                      <button
                        type="button"
                        onClick={() => onView(entry.name)}
                        className="group inline-flex cursor-pointer items-center justify-end gap-1 text-xs font-medium text-emerald-500 transition-colors hover:text-emerald-400"
                      >
                        View
                        <IconArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                      </button>
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
