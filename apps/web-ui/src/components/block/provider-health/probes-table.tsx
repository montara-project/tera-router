import { IconActivity } from '@tabler/icons-react'

import type { ProbeEntry } from '@/lib/api/models/provider-health'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'

const COLUMNS = 'grid grid-cols-[1.6fr_1fr_0.9fr_0.9fr_1.2fr] items-center gap-4'

interface ProbesTableProps {
  entries: ProbeEntry[]
}

export default function ProbesTable({ entries }: ProbesTableProps) {
  return (
    <Card className="bg-background">
      <CardContent className="overflow-x-auto p-0">
        <div className="min-w-[640px]">
          <div className={`${COLUMNS} border-b border-border px-5 py-3`}>
            <p className="text-muted-foreground text-xs">Probe</p>
            <p className="text-muted-foreground text-xs">Target</p>
            <p className="text-muted-foreground text-xs">Status</p>
            <p className="text-muted-foreground text-right text-xs">Latency</p>
            <p className="text-muted-foreground text-right text-xs">Last Run</p>
          </div>

          {entries.length === 0 ? (
            <Empty className="border-0 py-14">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <IconActivity />
                </EmptyMedia>
                <EmptyTitle>No probe runs yet</EmptyTitle>
                <EmptyDescription>Run a provider probe to populate this list.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="divide-y divide-border/60">
              {entries.map((probe) => (
                <div
                  key={probe.id}
                  className={`${COLUMNS} px-5 py-3.5 transition-colors hover:bg-muted/40`}
                >
                  <p className="truncate text-sm font-medium text-foreground">{probe.name}</p>
                  <p className="truncate font-mono text-xs text-muted-foreground">{probe.target}</p>
                  <div>
                    {probe.status === 'pass' ? (
                      <Badge variant="success" appearance="light" size="sm">
                        Passed
                      </Badge>
                    ) : (
                      <Badge variant="destructive" appearance="light" size="sm">
                        Failed
                      </Badge>
                    )}
                  </div>
                  <p className="text-right text-sm tabular-nums text-foreground">
                    {probe.status === 'pass' ? `${probe.latencyMs}ms` : '—'}
                  </p>
                  <p className="text-right truncate font-mono text-xs text-muted-foreground">
                    {probe.lastRun}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
