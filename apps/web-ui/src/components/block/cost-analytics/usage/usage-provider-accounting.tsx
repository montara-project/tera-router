import { IconPackages } from '@tabler/icons-react'
import { Link } from '@tanstack/react-router'

import type { UsageProviderAccountingRow } from '@/lib/api/models/usage'

import DashboardPanel from '@/components/block/dashboard/dashboard-panel'
import { HealthBadge } from '@/components/block/dashboard/overview-provider-health'
import { ProviderAvatar } from '@/components/block/providers/provider-avatar'
import { formatMicrosUsd } from '@/lib/currency'
import { formatCompact, formatCount, formatMs } from '@/lib/format'

/** Right-aligned two-line cell: main figure over a muted detail. */
function Figure({ value, detail }: { value: string; detail: string }) {
  return (
    <td className="px-4 py-3 text-right align-top whitespace-nowrap tabular-nums">
      <div className="text-[13px]">{value}</div>
      <div className="text-muted-foreground text-[11.5px]">{detail}</div>
    </td>
  )
}

export default function UsageProviderAccounting({ rows }: { rows: UsageProviderAccountingRow[] }) {
  return (
    <DashboardPanel
      title="Provider accounting"
      icon={IconPackages}
      action={{ label: 'Provider health', to: '/provider-health' }}
    >
      {rows.length === 0 ? (
        <p className="text-muted-foreground p-4 text-sm">No provider traffic in this period.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[60rem]">
            <thead className="text-muted-foreground border-b border-border text-xs dark:bg-muted/40">
              <tr>
                <th className="w-[30%] px-4 py-2 text-left font-medium">Provider</th>
                <th className="px-4 py-2 text-right font-medium">Requests</th>
                <th className="px-4 py-2 text-right font-medium">Input</th>
                <th className="px-4 py-2 text-right font-medium">Output</th>
                <th className="px-4 py-2 text-right font-medium">Cost</th>
                <th className="px-4 py-2 text-right font-medium">Latency</th>
                <th className="px-4 py-2 text-right font-medium">Priced</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const succeeded = row.requests - row.failed
                return (
                  <tr key={row.id} className="border-b border-border last:border-0">
                    <td className="max-w-0 px-4 py-3">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <ProviderAvatar
                          slug={row.slug}
                          apiKind={row.api_kind}
                          size="xs"
                          className="size-[22px] rounded-[4px]"
                        />
                        <div className="flex min-w-0 flex-col items-start gap-0.5">
                          {row.detailId ? (
                            <Link
                              to="/providers/$providerId"
                              params={{ providerId: row.detailId }}
                              className="max-w-full truncate rounded-sm text-[13px] font-medium hover:underline"
                              title={row.provider}
                            >
                              {row.provider}
                            </Link>
                          ) : (
                            <span
                              className="max-w-full truncate text-[13px] font-medium"
                              title={row.provider}
                            >
                              {row.provider}
                            </span>
                          )}
                          <HealthBadge status={row.status} />
                        </div>
                      </div>
                    </td>
                    <Figure
                      value={formatCount(row.requests)}
                      detail={`${row.successPct.toFixed(1)}% ok · ${formatCount(row.failed)} failed`}
                    />
                    <Figure
                      value={formatCompact(row.inputTokens)}
                      detail={`${formatCompact(row.cacheReadTokens)} cache read · ${formatCompact(row.cacheWriteTokens)} write`}
                    />
                    <Figure
                      value={formatCompact(row.outputTokens)}
                      detail={`${formatCompact(row.reasoningTokens)} reasoning`}
                    />
                    <Figure
                      value={formatMicrosUsd(row.costMicros)}
                      detail={`${formatMicrosUsd(row.savedMicros)} saved`}
                    />
                    <Figure
                      value={succeeded > 0 ? formatMs(row.latencyMs) : '—'}
                      detail={`TTFT ${row.ttftMs > 0 ? formatMs(row.ttftMs) : '—'} · p95 ${row.p95Ms > 0 ? formatMs(row.p95Ms) : '—'}`}
                    />
                    {succeeded > 0 ? (
                      <Figure
                        value={`${row.coverage.toFixed(0)}%`}
                        detail={`${formatCount(row.pricingEst)} of ${formatCount(row.requests)} priced`}
                      />
                    ) : (
                      <Figure value="—" detail="Nothing to price" />
                    )}
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
