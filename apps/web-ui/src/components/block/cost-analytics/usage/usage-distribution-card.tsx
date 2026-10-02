import { IconServer2 } from '@tabler/icons-react'
import { useState } from 'react'

import type { UsageTelemetryOverview } from '@/lib/api/models/usage'

import { ProviderAvatar } from '@/components/block/providers/provider-avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

const PAGE_SIZE = 5

interface DistributionCardProps {
  telemetry: UsageTelemetryOverview
}

export default function UsageDistributionCard({ telemetry }: DistributionCardProps) {
  const { distribution, distributionTotalRequests, distributionActiveProviders } = telemetry
  const [page, setPage] = useState(1)

  const pageCount = Math.max(Math.ceil(distribution.length / PAGE_SIZE), 1)
  const safePage = Math.min(page, pageCount)
  const visible = distribution.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  return (
    <Card className="h-full bg-background">
      <CardContent className="flex flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <IconServer2 className="h-4 w-4 text-muted-foreground" />
            Provider distribution
          </p>
          <p className="text-muted-foreground text-xs">{distributionActiveProviders} providers</p>
        </div>
        <p className="text-muted-foreground mt-0.5 text-xs">
          Request and token shares from recorded terminal requests.
        </p>

        <div className="mt-5 flex h-2.5 overflow-hidden rounded-full bg-muted">
          {distribution.map((entry) => (
            <div
              key={entry.provider}
              style={{ width: `${entry.requestShare}%` }}
              className="bg-emerald-600/80"
            />
          ))}
        </div>

        <div className="mt-5 min-h-61 space-y-4 mb-2">
          {visible.map((entry) => (
            <div key={entry.provider} className="flex items-center gap-3">
              <ProviderAvatar slug={entry.provider} apiKind={entry.api_kind} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{entry.provider}</p>
                <p className="text-muted-foreground text-xs">{entry.requests} requests</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-semibold text-foreground">{entry.requestShare}%</p>
                <p className="text-muted-foreground text-xs">{entry.tokenShare}% tokens</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-auto flex items-center justify-between border-t border-border pt-2">
          <p className="text-muted-foreground text-xs">
            {distributionTotalRequests} total requests
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={safePage <= 1}
              onClick={() => setPage((current) => Math.max(current - 1, 1))}
            >
              Previous
            </Button>
            <span className="text-muted-foreground text-xs tabular-nums">
              {safePage} / {pageCount}
            </span>
            <Button
              variant="ghost"
              size="sm"
              disabled={safePage >= pageCount}
              onClick={() => setPage((current) => Math.min(current + 1, pageCount))}
            >
              Next
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
