import { IconCpu, IconGauge, IconHistory } from '@tabler/icons-react'
import { useState } from 'react'

import type { PortalLimit, PortalModel, PortalRequest } from '@/lib/api/models/portal'
import type { UsageTerminalRequestRow } from '@/lib/api/models/usage'

import EmptyState from '@/components/block/common/empty-state'
import ReactTable from '@/components/block/common/react-table'
import SectionCardPanel from '@/components/block/common/section-card-panel'
import RequestDetailDialog from '@/components/block/cost-analytics/usage/request-detail-dialog'
import { usePaginationQuery } from '@/hooks/use-pagination-query'
import { formatMicrosUsd } from '@/lib/currency'
import { formatDateTime, formatResetsIn } from '@/lib/date'
import { formatCompact, formatCount } from '@/lib/format'

import ModelName from './model-name'
import { PortalRecentColumn } from './recent/column'

const PAGE_SIZES = [15, 30, 50]

function CountPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-sm bg-muted px-1.5 py-0.5 text-[11.5px] font-medium text-muted-foreground tabular-nums">
      {children}
    </span>
  )
}

function Bar({ pct }: { pct: number }) {
  return (
    <span className="block h-1.5 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden>
      <span
        className="bg-primary block h-full rounded-full"
        style={{ width: `${Math.min(Math.max(pct, 0), 100)}%` }}
      />
    </span>
  )
}

/** Plan and budget caps with their use this period, then the model allowlist. */
export function PortalLimits({
  limits,
  allowedModels,
}: {
  limits: PortalLimit[]
  allowedModels: string[]
}) {
  return (
    <SectionCardPanel icon={IconGauge} title="Limits" className="h-full">
      {limits.length === 0 ? (
        <p className="px-4 py-3 text-[12.5px] text-muted-foreground">
          No spend or token limit on this key.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {limits.map((l) => {
            const pct = l.limit > 0 ? (l.used / l.limit) * 100 : 0
            const fmt = l.kind === 'spend' ? formatMicrosUsd : formatCompact
            return (
              <li key={`${l.label}-${l.resets_at}`} className="flex flex-col gap-1.5 px-4 py-3">
                <div className="flex items-center justify-between gap-3 text-[13px]">
                  <span className="font-medium">{l.label}</span>
                  <span className="font-medium tabular-nums">
                    {pct > 0 && pct < 0.1 ? '<0.1' : pct.toFixed(1)}%
                  </span>
                </div>
                <span className="flex">
                  <Bar pct={pct} />
                </span>
                <div className="flex flex-wrap items-center justify-between gap-x-3 text-xs text-muted-foreground tabular-nums">
                  <span>
                    {fmt(l.used)} of {fmt(l.limit)} · {fmt(Math.max(l.limit - l.used, 0))} left
                  </span>
                  <span title={formatDateTime(l.resets_at)}>{formatResetsIn(l.resets_at)}</span>
                </div>
              </li>
            )
          })}
        </ul>
      )}
      <div className="mt-auto flex flex-col gap-1 border-t border-border px-4 py-3">
        <p className="text-[12.5px] font-medium">Allowed models</p>
        {allowedModels.length === 0 ? (
          <p className="text-[12.5px] text-muted-foreground">Every model is allowed.</p>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {allowedModels.map((m) => (
              <li
                key={m}
                className="rounded-sm border border-border bg-muted/40 px-1.5 py-0.5 font-mono text-xs"
              >
                {m}
              </li>
            ))}
          </ul>
        )}
      </div>
    </SectionCardPanel>
  )
}

/** Traffic per model with each model's share of requests and a total row. */
export function PortalModels({ models }: { models: PortalModel[] }) {
  const totals = models.reduce(
    (t, m) => ({
      requests: t.requests + m.requests,
      prompt: t.prompt + m.prompt_tokens,
      completion: t.completion + m.completion_tokens,
      cost: t.cost + m.cost_micros,
    }),
    { requests: 0, prompt: 0, completion: 0, cost: 0 }
  )

  return (
    <SectionCardPanel
      icon={IconCpu}
      title={
        <>
          Models <CountPill>{models.length}</CountPill>
        </>
      }
    >
      {models.length === 0 ? (
        <p className="px-4 py-6 text-center text-[13px] text-muted-foreground">
          No requests in this period.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[48rem] text-[13px]">
            <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="w-[36%] px-4 py-2 text-left font-medium">Model</th>
                <th className="w-[24%] px-4 py-2 text-left font-medium">Requests</th>
                <th className="px-4 py-2 text-right font-medium">Input</th>
                <th className="px-4 py-2 text-right font-medium">Output</th>
                <th className="px-4 py-2 text-right font-medium">Avg / request</th>
                <th className="px-4 py-2 text-right font-medium">Cost</th>
              </tr>
            </thead>
            <tbody>
              {models.map((m) => {
                const share = totals.requests > 0 ? (m.requests / totals.requests) * 100 : 0
                return (
                  <tr key={`${m.provider}/${m.model}`} className="border-b border-border">
                    <td className="max-w-0 px-4 py-2.5">
                      <ModelName provider={m.provider} apiKind={m.api_kind} model={m.model} />
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="flex items-center gap-2.5 tabular-nums">
                        <span className="w-10 shrink-0">{formatCount(m.requests)}</span>
                        <Bar pct={share} />
                        <span className="w-9 shrink-0 text-right text-xs text-muted-foreground">
                          {Math.round(share)}%
                        </span>
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground tabular-nums">
                      {formatCompact(m.prompt_tokens)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground tabular-nums">
                      {formatCompact(m.completion_tokens)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground tabular-nums">
                      {m.requests > 0
                        ? formatCompact(
                            Math.round((m.prompt_tokens + m.completion_tokens) / m.requests)
                          )
                        : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium text-muted-foreground tabular-nums">
                      {formatMicrosUsd(m.cost_micros)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot className="bg-muted/40 text-[12.5px]">
              <tr>
                <td className="px-4 py-2.5 font-medium">Total</td>
                <td className="px-4 py-2.5 font-medium tabular-nums">
                  {formatCount(totals.requests)}
                </td>
                <td className="px-4 py-2.5 text-right text-muted-foreground tabular-nums">
                  {formatCompact(totals.prompt)}
                </td>
                <td className="px-4 py-2.5 text-right text-muted-foreground tabular-nums">
                  {formatCompact(totals.completion)}
                </td>
                <td className="px-4 py-2.5 text-right text-muted-foreground tabular-nums">
                  {totals.requests > 0
                    ? formatCompact(
                        Math.round((totals.prompt + totals.completion) / totals.requests)
                      )
                    : '—'}
                </td>
                <td className="px-4 py-2.5 text-right font-medium tabular-nums">
                  {formatMicrosUsd(totals.cost)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </SectionCardPanel>
  )
}

/** Shapes a portal attempt for the request detail dialog shared with /usage.
 * A failed attempt has no billable usage, as on /usage. */
function toDetailRow(r: PortalRequest): UsageTerminalRequestRow {
  const tokens = r.prompt_tokens + r.completion_tokens
  return {
    id: String(r.id),
    status: r.failed ? 'failed' : 'success',
    usage: !r.failed && tokens > 0 ? 'provider' : 'none',
    model: r.model,
    provider: r.provider,
    api_kind: r.api_kind,
    inputTokens: Math.max(r.prompt_tokens - r.cached_tokens - r.cache_write_tokens, 0),
    inputCacheRead: r.cached_tokens,
    inputCacheWrite: r.cache_write_tokens,
    outputTokens: r.completion_tokens,
    reasoningTokens: r.reasoning_tokens,
    costMicros: r.failed ? null : r.cost_micros,
    costNote: r.failed ? 'No billable usage' : null,
    tokenConsumptionRate: r.token_consumption_rate,
    // Only total latency is recorded, so upstream reads the same, as on /usage.
    latencyMs: r.latency_ms,
    upstreamMs: r.latency_ms,
    time: formatDateTime(r.created_at),
    createdAt: r.created_at,
    client: '',
    providerName: '',
    keyName: '',
  }
}

/** The key's newest attempts, a page at a time. */
export function PortalRecent({ recent, requests }: { recent: PortalRequest[]; requests: number }) {
  const [selected, setSelected] = useState<PortalRequest | null>(null)
  // The list arrives whole (capped by the server), so paging runs here.
  const { offset, limit, pageIndex } = usePaginationQuery({ defaultLimit: PAGE_SIZES[0] })
  const columns = PortalRecentColumn({ onOpen: setSelected })

  return (
    <SectionCardPanel
      icon={IconHistory}
      title={
        <>
          Recent requests <CountPill>{formatCount(recent.length)}</CountPill>
        </>
      }
      description={
        recent.length < requests
          ? `Latest ${formatCount(recent.length)} of ${formatCount(requests)}`
          : undefined
      }
    >
      <ReactTable
        data={recent.slice(offset, offset + limit)}
        total={recent.length}
        pageIndex={pageIndex}
        pageSize={limit}
        pageSizes={PAGE_SIZES}
        columns={columns}
        tableClassName="min-w-[52rem]"
        emptyMessage={
          <EmptyState
            icon={IconHistory}
            title="No requests"
            description="No requests in this period."
            className="py-8"
          />
        }
      />
      {selected && (
        <RequestDetailDialog open onClose={() => setSelected(null)} row={toDetailRow(selected)} />
      )}
    </SectionCardPanel>
  )
}
