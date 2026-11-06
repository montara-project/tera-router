import { IconRoute } from '@tabler/icons-react'

import type { UsageTelemetryOverview } from '@/lib/api/models/usage'

import DashboardPanel from '@/components/block/dashboard/dashboard-panel'
import { ProviderAvatar } from '@/components/block/providers/provider-avatar'
import { formatMicrosUsd } from '@/lib/currency'
import { formatCount } from '@/lib/format'

/** Share of requests per provider, with token share and spend underneath. */
export default function UsageDistributionPanel({
  telemetry,
}: {
  telemetry: UsageTelemetryOverview
}) {
  const accounting = new Map(telemetry.providerAccounting.map((p) => [p.slug, p]))

  return (
    <DashboardPanel title="Where requests went" icon={IconRoute}>
      <ul className="scrollbar-seamless flex max-h-80 flex-col gap-4 overflow-y-auto overscroll-contain p-4">
        {telemetry.distribution.length === 0 && (
          <li className="text-muted-foreground text-sm">No requests in this period.</li>
        )}
        {telemetry.distribution.map((d) => {
          const row = accounting.get(d.provider)
          const name = row?.provider ?? d.provider
          return (
            <li key={d.provider} className="flex items-start gap-3">
              <ProviderAvatar slug={d.provider} apiKind={d.api_kind} size="xs" className="mt-0.5" />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <div className="flex items-center justify-between gap-3 text-[13px]">
                  <span className="truncate font-medium" title={name}>
                    {name}
                  </span>
                  <span className="tabular-nums">{d.requestShare.toFixed(1)}%</span>
                </div>
                <div className="bg-muted h-1.5 overflow-hidden rounded-full" aria-hidden>
                  <div
                    className="bg-primary h-full rounded-full"
                    style={{ width: `${d.requestShare}%` }}
                  />
                </div>
                <p className="text-muted-foreground text-xs tabular-nums">
                  {formatCount(d.requests)} req · {d.tokenShare.toFixed(1)}% of tokens ·{' '}
                  {formatMicrosUsd(row?.costMicros ?? 0)}
                </p>
              </div>
            </li>
          )
        })}
      </ul>
    </DashboardPanel>
  )
}
