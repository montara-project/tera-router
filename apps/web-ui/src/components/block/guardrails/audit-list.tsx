import type { GuardrailsAuditEntry } from '@/lib/api/models/guardrails'

import { Card, CardContent } from '@/components/ui/card'

interface AuditListProps {
  entries: GuardrailsAuditEntry[]
}

const COLUMNS = 'grid grid-cols-[10.5rem_1fr_11rem_11rem] items-center gap-4'

export default function AuditList({ entries }: AuditListProps) {
  if (entries.length === 0) {
    return (
      <Card className="bg-background">
        <CardContent className="text-muted-foreground flex min-h-32 items-center justify-center text-sm">
          No audit events yet.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-background">
      <CardContent className="overflow-x-auto p-0">
        <div className="min-w-[720px]">
          <div className={`${COLUMNS} border-b border-border px-5 py-3`}>
            <p className="text-muted-foreground text-xs">Time</p>
            <p className="text-muted-foreground text-xs">Action</p>
            <p className="text-muted-foreground text-xs">Actor</p>
            <p className="text-muted-foreground text-xs">Target</p>
          </div>

          <div className="divide-y divide-border/60">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className={`${COLUMNS} px-5 py-3 transition-colors hover:bg-muted/40`}
              >
                <p className="text-muted-foreground font-mono text-xs whitespace-nowrap">
                  {entry.time}
                </p>
                <p className="truncate text-sm font-medium text-foreground">{entry.action}</p>
                <p className="text-muted-foreground truncate text-xs">{entry.actor}</p>
                <p className="text-muted-foreground truncate font-mono text-xs">{entry.target}</p>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
