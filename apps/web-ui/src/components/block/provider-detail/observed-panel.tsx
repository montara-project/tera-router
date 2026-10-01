import { IconApps } from '@tabler/icons-react'

import type { Models } from '@/lib/api/models'

import { fmtLatency } from '@/components/block/cost-analytics/usage/format'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardHeading,
  CardTitle,
} from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'

export default function ObservedPanel({
  models,
  loading,
}: {
  models: Models.UsageModelAccountingRow[]
  loading: boolean
}) {
  if (loading)
    return (
      <div className="space-y-2">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    )
  if (!models.length) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <IconApps />
          </EmptyMedia>
          <EmptyTitle>No observed models yet</EmptyTitle>
          <EmptyDescription>
            Models appear here after this provider has terminal usage. The catalog tab lists every
            model the provider exposes.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }
  return (
    <Card className="bg-background">
      <CardHeader className="h-20">
        <CardHeading>
          <CardTitle>Observed models ({models.length})</CardTitle>
          <CardDescription>Models seen in terminal usage for this provider.</CardDescription>
        </CardHeading>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-border/60">
          {models.map((model) => (
            <div
              key={model.id}
              className="grid grid-cols-[1.4fr_0.8fr_0.9fr_1fr] items-center gap-4 px-5 py-3"
            >
              <div>
                <p className="font-mono text-sm font-medium">{model.model}</p>
                <p className="text-xs text-muted-foreground">{model.provider}</p>
              </div>
              <span className="text-sm tabular-nums">{model.requests} requests</span>
              <span className="text-sm tabular-nums">{model.successPct}% success</span>
              <span className="text-sm tabular-nums">{fmtLatency(model.latencyMs)} avg</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
