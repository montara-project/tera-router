import { IconBolt, IconSearch } from '@tabler/icons-react'
import { useMemo, useState } from 'react'

import type { UsageTerminalRequestRow } from '@/lib/api/models/usage'

import DashboardPanel from '@/components/block/dashboard/dashboard-panel'
import { ProviderAvatar } from '@/components/block/providers/provider-avatar'
import { Input } from '@/components/ui/input'
import { formatMicrosUsd } from '@/lib/currency'
import { formatDateTime } from '@/lib/date'
import { formatCount, formatMs } from '@/lib/format'
import { cn } from '@/lib/utils'

import RequestDetailDialog from './request-detail-dialog'

type Row = UsageTerminalRequestRow

const STATUS: Record<Row['status'], { label: string; tone: string }> = {
  success: {
    label: 'Success',
    tone: 'bg-emerald-500/10 text-emerald-700 ring-emerald-500/25 dark:text-emerald-400',
  },
  failed: {
    label: 'Failed',
    tone: 'bg-destructive/10 text-red-700 ring-destructive/25 dark:text-red-400',
  },
  cancelled: { label: 'Cancelled', tone: 'text-muted-foreground ring-border' },
}

const USAGE: Record<Row['usage'], string> = {
  provider: 'Provider usage',
  estimate: 'Usage estimate',
  none: 'No usage reported',
}

const Chip = ({ label, tone }: { label: string; tone: string }) => (
  <span
    className={cn(
      'inline-flex h-5 items-center rounded-sm px-1.5 text-[11.5px] font-medium whitespace-nowrap ring-1 ring-inset',
      tone
    )}
  >
    {label}
  </span>
)

/** Right-aligned two-line cell: main figure over an optional muted detail. */
function Figure({ value, detail }: { value: string; detail?: string }) {
  return (
    <td className="px-4 py-3 text-right align-top whitespace-nowrap tabular-nums">
      <div className="text-[13px]">{value}</div>
      {detail && <div className="text-muted-foreground text-[11.5px]">{detail}</div>}
    </td>
  )
}

export default function UsageRecentRequests({ rows }: { rows: Row[] }) {
  const [search, setSearch] = useState('')
  const [failedOnly, setFailedOnly] = useState(false)
  const [selected, setSelected] = useState<Row | null>(null)
  const failedCount = rows.filter((r) => r.status === 'failed').length

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter(
      (r) =>
        (!failedOnly || r.status === 'failed') &&
        (!q ||
          [r.model, r.keyName, r.client, r.id, r.provider, r.providerName].some((v) =>
            v?.toLowerCase().includes(q)
          ))
    )
  }, [rows, search, failedOnly])

  const filters = [
    { label: 'All', count: rows.length, active: !failedOnly, onClick: () => setFailedOnly(false) },
    { label: 'Failed', count: failedCount, active: failedOnly, onClick: () => setFailedOnly(true) },
  ]

  return (
    <>
      <DashboardPanel
        title="Recent requests"
        icon={IconBolt}
        toolbar={
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <div className="relative min-w-0 flex-1 sm:w-56 sm:flex-none">
              <IconSearch
                className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
                stroke={1.75}
                aria-hidden
              />
              <Input
                value={search}
                placeholder="Model, key, client or ID"
                aria-label="Filter by model, key, client or ID"
                className="h-8 pl-8 text-[13px]"
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div role="group" aria-label="Request status" className="flex gap-1">
              {filters.map((f) => (
                <button
                  key={f.label}
                  type="button"
                  aria-pressed={f.active}
                  onClick={f.onClick}
                  className={cn(
                    'inline-flex h-8 items-center gap-1.5 rounded-sm border px-2.5 text-xs font-medium transition-colors',
                    f.active
                      ? 'border-primary/30 bg-primary/10 text-primary'
                      : 'text-muted-foreground border-border hover:text-foreground'
                  )}
                >
                  {f.label}
                  <span className="tabular-nums">{f.count}</span>
                </button>
              ))}
            </div>
          </div>
        }
      >
        {visible.length === 0 ? (
          <p className="text-muted-foreground p-4 text-sm">
            {rows.length === 0 ? 'No requests in this period.' : 'No requests match these filters.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[58rem]">
              <thead className="text-muted-foreground border-b border-border text-xs dark:bg-muted/40">
                <tr>
                  <th className="w-px px-4 py-2 text-left font-medium">Time</th>
                  <th className="w-px px-4 py-2 text-left font-medium">Status</th>
                  <th className="w-[34%] px-4 py-2 text-left font-medium">Model</th>
                  <th className="px-4 py-2 text-right font-medium">Tokens in → out</th>
                  <th className="px-4 py-2 text-right font-medium">Cost</th>
                  <th className="px-4 py-2 text-right font-medium">Latency</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => {
                  const tokensIn = row.inputTokens + row.inputCacheRead + row.inputCacheWrite
                  return (
                    <tr key={row.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 align-top">
                        <button
                          type="button"
                          onClick={() => setSelected(row)}
                          title={formatDateTime(row.createdAt)}
                          aria-label={`Open request #${row.id} from ${row.time}`}
                          className="text-muted-foreground hover:text-foreground h-6 rounded-sm font-mono text-xs whitespace-nowrap underline-offset-2 hover:underline"
                        >
                          {row.time}
                        </button>
                      </td>
                      <td className="px-4 py-3.5 align-top">
                        <div className="flex gap-1.5">
                          <Chip {...STATUS[row.status]} />
                          <Chip
                            label={USAGE[row.usage]}
                            tone="text-muted-foreground ring-border dark:bg-muted/40"
                          />
                        </div>
                      </td>
                      <td className="max-w-0 px-4 py-2.5">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <ProviderAvatar
                            slug={row.provider}
                            apiKind={row.api_kind}
                            size="xs"
                            className="size-5 rounded-[4px]"
                          />
                          <div className="min-w-0">
                            <p className="truncate font-mono text-[12.5px]" title={row.model}>
                              {row.model}
                            </p>
                            <p className="text-muted-foreground truncate text-[11.5px]">
                              {row.providerName || row.provider}
                              {row.keyName && ` · ${row.keyName}`}
                            </p>
                          </div>
                        </div>
                      </td>
                      <Figure
                        value={`${formatCount(tokensIn)} → ${formatCount(row.outputTokens)}`}
                      />
                      <Figure
                        value={
                          row.costMicros === null
                            ? row.costNote
                              ? '$0.00'
                              : '—'
                            : formatMicrosUsd(row.costMicros)
                        }
                        detail={row.costNote ?? (row.costMicros === null ? 'Unpriced' : undefined)}
                      />
                      <Figure
                        value={row.latencyMs > 0 ? formatMs(row.latencyMs) : '—'}
                        // Only worth a line when upstream time was measured apart from the total.
                        detail={
                          row.upstreamMs > 0 && row.upstreamMs !== row.latencyMs
                            ? `upstream ${formatMs(row.upstreamMs)}`
                            : undefined
                        }
                      />
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </DashboardPanel>

      {selected && <RequestDetailDialog open onClose={() => setSelected(null)} row={selected} />}
    </>
  )
}
