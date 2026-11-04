import { IconBolt } from '@tabler/icons-react'

import type { UsageTerminalRequestRow } from '@/lib/api/models/usage'

import DashboardPanel from '@/components/block/dashboard/dashboard-panel'
import { ProviderAvatar } from '@/components/block/providers/provider-avatar'
import { formatMicrosUsd } from '@/lib/currency'
import { formatClock, formatDate } from '@/lib/date'
import { formatCount, formatMs } from '@/lib/format'
import { cn } from '@/lib/utils'

const LIMIT = 8

/** Upstream failure classes (server core.ErrorKind) as short badge labels. */
const ERROR_LABELS: Record<string, string> = {
  auth: 'Auth error',
  rate_limit: 'Rate limit',
  quota_exhausted: 'Quota exhausted',
  account_suspended: 'Account suspended',
  upstream: 'Upstream error',
  upstream_blocked: 'Upstream blocked',
  timeout: 'Timeout',
  bad_request: 'Bad request',
  context_too_large: 'Context too large',
  capability: 'Model unavailable',
  budget_blocked: 'Budget blocked',
}

function statusLabel(row: UsageTerminalRequestRow) {
  if (row.status === 'success') return 'Success'
  if (row.status === 'cancelled') return 'Cancelled'
  return ERROR_LABELS[row.errorKind ?? ''] ?? 'Failed'
}

/** Today's requests show the clock time; older ones the date too. */
function requestTime(iso: string) {
  const at = new Date(iso)
  return at.toDateString() === new Date().toDateString()
    ? formatClock(at)
    : formatDate(at, 'MMM d, HH:mm')
}

export default function OverviewRecentRequests({ rows }: { rows: UsageTerminalRequestRow[] }) {
  const visible = rows.slice(0, LIMIT)

  return (
    <DashboardPanel
      title="Recent requests"
      icon={IconBolt}
      action={{ label: 'All requests', to: '/usage' }}
    >
      {visible.length === 0 ? (
        <p className="text-muted-foreground p-4 text-sm">No requests yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[44rem] text-[13px]">
            <thead className="dark:bg-muted/40 text-muted-foreground border-b border-border text-xs">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Time</th>
                <th className="px-4 py-2 text-left font-medium">Status</th>
                <th className="w-2/5 px-4 py-2 text-left font-medium">Model</th>
                <th className="px-4 py-2 text-right font-medium">Latency</th>
                <th className="px-4 py-2 text-right font-medium">Tokens in → out</th>
                <th className="px-4 py-2 text-right font-medium">Cost</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => {
                const ok = row.status === 'success'
                const tokensIn = row.inputTokens + row.inputCacheRead + row.inputCacheWrite
                return (
                  <tr key={row.id} className="border-b border-border last:border-0">
                    <td className="text-muted-foreground px-4 py-2.5 font-mono text-xs whitespace-nowrap tabular-nums">
                      <time dateTime={row.createdAt}>{requestTime(row.createdAt)}</time>
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={cn(
                          'inline-flex rounded-sm px-1.5 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset',
                          ok
                            ? 'bg-emerald-500/10 text-emerald-700 ring-emerald-500/25 dark:text-emerald-400'
                            : 'bg-destructive/10 text-red-700 ring-destructive/25 dark:text-red-400'
                        )}
                        title={row.errorStatus ? `HTTP ${row.errorStatus}` : undefined}
                      >
                        {statusLabel(row)}
                      </span>
                    </td>
                    <td className="max-w-0 px-4 py-2.5">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <ProviderAvatar slug={row.provider} apiKind={row.api_kind} size="xs" />
                        <div className="min-w-0 font-mono">
                          <p className="truncate" title={row.model}>
                            {row.model}
                          </p>
                          <p className="text-muted-foreground truncate text-xs">
                            {row.provider} · {row.client || 'unknown'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap tabular-nums">
                      {row.latencyMs > 0 ? formatMs(row.latencyMs) : '—'}
                    </td>
                    <td className="text-muted-foreground px-4 py-2.5 text-right whitespace-nowrap tabular-nums">
                      {tokensIn + row.outputTokens > 0
                        ? `${formatCount(tokensIn)} → ${formatCount(row.outputTokens)}`
                        : '—'}
                    </td>
                    <td className="text-muted-foreground px-4 py-2.5 text-right tabular-nums">
                      {row.costMicros === null ? '—' : formatMicrosUsd(row.costMicros)}
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
