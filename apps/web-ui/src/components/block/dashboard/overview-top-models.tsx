import { IconBrain } from '@tabler/icons-react'

import type { UsageTelemetryOverview } from '@/lib/api/models/usage'

import DashboardPanel from '@/components/block/dashboard/dashboard-panel'
import { ProviderAvatar } from '@/components/block/providers/provider-avatar'
import { formatMicrosUsd } from '@/lib/currency'
import { formatCompact, formatCount } from '@/lib/format'

const LIMIT = 6

export default function OverviewTopModels({ telemetry }: { telemetry: UsageTelemetryOverview }) {
  const total = telemetry.traffic.requests
  const rows = [...telemetry.modelAccounting]
    .sort((a, b) => b.requests - a.requests)
    .slice(0, LIMIT)

  return (
    <DashboardPanel
      title="Top models"
      icon={IconBrain}
      action={{ label: 'All models', to: '/usage' }}
    >
      {rows.length === 0 ? (
        <p className="text-muted-foreground p-4 text-sm">No model traffic in this period.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] text-[13px]">
            <thead className="dark:bg-muted/40 text-muted-foreground border-b border-border text-xs">
              <tr>
                <th className="w-2/5 px-4 py-2 text-left font-medium">Model</th>
                <th className="px-4 py-2 text-right font-medium">Requests</th>
                <th className="px-4 py-2 text-right font-medium">Tokens</th>
                <th className="px-4 py-2 text-right font-medium">Cost</th>
                <th className="w-40 px-4 py-2 text-left font-medium">Share</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const share = total > 0 ? (row.requests / total) * 100 : 0
                const tokens = row.inputTokens + row.cachedTokens + row.outputTokens
                return (
                  <tr key={row.id} className="border-b border-border last:border-0">
                    <td className="max-w-0 px-4 py-2.5">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <ProviderAvatar slug={row.provider} apiKind={row.api_kind} size="xs" />
                        <div className="min-w-0 font-mono">
                          <p className="truncate" title={row.model}>
                            {row.model}
                          </p>
                          <p
                            className="text-muted-foreground truncate text-xs"
                            title={row.provider}
                          >
                            {row.provider}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {formatCount(row.requests)}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{formatCompact(tokens)}</td>
                    <td className="text-muted-foreground px-4 py-2.5 text-right tabular-nums">
                      {row.costMicros === null ? '—' : formatMicrosUsd(row.costMicros)}
                    </td>
                    <td className="text-muted-foreground px-4 py-2.5 text-right text-xs tabular-nums">
                      <span
                        className="bg-muted mr-3 inline-block h-1.5 w-[calc(100%-3rem)] overflow-hidden rounded-full align-middle"
                        aria-hidden
                      >
                        <span
                          className="bg-primary block h-full rounded-full"
                          style={{ width: `${share}%` }}
                        />
                      </span>
                      {Math.round(share)}%
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </DashboardPanel>
  )
}
