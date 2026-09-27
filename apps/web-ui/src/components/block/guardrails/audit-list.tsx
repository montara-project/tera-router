import type { GuardrailsAuditEntry } from '@/lib/api/models/guardrails'

import { Card, CardContent } from '@/components/ui/card'

interface AuditListProps {
  entries: GuardrailsAuditEntry[]
}

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
      <CardContent className="p-0">
        <div className="divide-y divide-border/60">
          {entries.map((entry) => (
            <div key={entry.id} className="flex items-center gap-4 px-5 py-3 text-sm">
              <span className="text-muted-foreground w-40 shrink-0 font-mono text-xs">
                {entry.time}
              </span>
              <span className="min-w-0 flex-1 truncate font-medium text-foreground">
                {entry.action}
              </span>
              <span className="text-muted-foreground hidden w-44 shrink-0 truncate lg:block">
                {entry.actor}
              </span>
              <span className="text-muted-foreground w-44 shrink-0 truncate text-xs">
                {entry.target}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
