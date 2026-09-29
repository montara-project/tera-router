import { IconServer2 } from '@tabler/icons-react'

import type { UsageTelemetryOverview } from '@/lib/api/models/usage'

import { ProviderAvatar } from '@/components/block/providers/provider-avatar'
import { Card, CardContent } from '@/components/ui/card'

interface DistributionCardProps {
  telemetry: UsageTelemetryOverview
}

export default function UsageDistributionCard({ telemetry }: DistributionCardProps) {
  const { distribution, distributionTotalRequests, distributionActiveProviders } = telemetry

  return (
    <Card className="bg-background">
      <CardContent className="p-5">
        <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <IconServer2 className="h-4 w-4 text-muted-foreground" />
          Provider distribution
        </p>
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

        <div className="mt-5 space-y-4">
          {distribution.map((entry) => (
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

        <p className="text-muted-foreground mt-5 text-xs">
          {distributionTotalRequests} terminal requests across {distributionActiveProviders} active
          providers.
        </p>
      </CardContent>
    </Card>
  )
}
