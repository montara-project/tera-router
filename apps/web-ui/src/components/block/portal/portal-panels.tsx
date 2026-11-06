import { IconCpu, IconGauge, IconHistory } from '@tabler/icons-react'
import { useState } from 'react'

import type { PortalLimit, PortalModel, PortalRequest } from '@/lib/api/models/portal'

import SectionCardPanel from '@/components/block/common/section-card-panel'
import { ProviderAvatar } from '@/components/block/providers/provider-avatar'
import { Button } from '@/components/ui/button'
import { formatMicrosUsd } from '@/lib/currency'
import { formatDateTime, formatResetsIn } from '@/lib/date'
import { formatCompact, formatCount, formatKb, formatMs } from '@/lib/format'
import { cn } from '@/lib/utils'

const PAGE_SIZE = 15

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

function ModelName({ provider, model }: { provider: string; model: string }) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <ProviderAvatar slug={provider} size="xs" className="size-5" />
      <span className="min-w-0">
        <span className="block truncate font-mono text-[12.5px]" title={model}>
          {model}
        </span>
        <span className="block truncate text-[11.5px] text-muted-foreground">{provider}</span>
      </span>
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
                      <ModelName provider={m.provider} model={m.model} />
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

function Tag({
  tone = 'muted',
  children,
  title,
}: {
  tone?: 'muted' | 'bad'
  children: string
  title?: string
}) {
  return (
    <span
      title={title}
      className={cn(
        'rounded-sm px-1.5 py-0.5 text-[11px] font-medium',
        tone === 'bad'
          ? 'bg-destructive/10 text-destructive'
          : 'border border-border bg-muted/40 text-muted-foreground'
      )}
    >
      {children}
    </span>
  )
}

/** The key's newest attempts, a page at a time. */
export function PortalRecent({ recent, requests }: { recent: PortalRequest[]; requests: number }) {
  const [page, setPage] = useState(0)
  const pages = Math.max(1, Math.ceil(recent.length / PAGE_SIZE))
  const current = Math.min(page, pages - 1)
  const rows = recent.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE)

  return (
    <SectionCardPanel
      icon={IconHistory}
      title={
        <>
          Recent requests <CountPill>{formatCount(recent.length)}</CountPill>
        </>
      }
    >
      {recent.length === 0 ? (
        <p className="px-4 py-6 text-center text-[13px] text-muted-foreground">
          No requests in this period.
        </p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[52rem] text-[13px]">
              <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Time</th>
                  <th className="w-[34%] px-4 py-2 text-left font-medium">Model</th>
                  <th className="px-4 py-2 text-right font-medium">Tokens in → out</th>
                  <th className="px-4 py-2 text-right font-medium">Cost</th>
                  <th className="px-4 py-2 text-right font-medium">Latency</th>
                  <th className="px-4 py-2 text-left font-medium">Optimizations</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const tags = [
                    r.failed && (
                      <Tag key="f" tone="bad">
                        Failed
                      </Tag>
                    ),
                    r.cache_hit && <Tag key="c">Cache hit</Tag>,
                    r.prompt_reduced_bytes > 0 && (
                      <Tag key="p" title={`Prompt shrunk by ${formatKb(r.prompt_reduced_bytes)}`}>
                        Compressed
                      </Tag>
                    ),
                    r.output_shaped && <Tag key="o">Output shaped</Tag>,
                  ].filter(Boolean)
                  return (
                    <tr
                      key={`${r.created_at}-${i}`}
                      className="border-b border-border last:border-0"
                    >
                      <td className="px-4 py-2.5 whitespace-nowrap text-muted-foreground tabular-nums">
                        {formatDateTime(r.created_at)}
                      </td>
                      <td className="max-w-0 px-4 py-2.5">
                        <ModelName provider={r.provider} model={r.model} />
                      </td>
                      <td className="px-4 py-2.5 text-right whitespace-nowrap text-muted-foreground tabular-nums">
                        {formatCompact(r.prompt_tokens)} → {formatCompact(r.completion_tokens)}
                      </td>
                      <td className="px-4 py-2.5 text-right text-muted-foreground tabular-nums">
                        {formatMicrosUsd(r.cost_micros)}
                      </td>
                      <td className="px-4 py-2.5 text-right text-muted-foreground tabular-nums">
                        {formatMs(r.latency_ms)}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="flex flex-wrap gap-1">
                          {tags.length > 0 ? (
                            tags
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <nav
            aria-label="Request pages"
            className="flex items-center justify-between gap-2 border-t border-border bg-muted/40 px-4 py-2"
          >
            <span className="text-xs text-muted-foreground tabular-nums">
              {recent.length < requests
                ? `Latest ${formatCount(recent.length)} of ${formatCount(requests)}`
                : `${formatCount(recent.length)} total`}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                disabled={current === 0}
                onClick={() => setPage(current - 1)}
              >
                Previous
              </Button>
              <span className="px-3 text-xs font-medium tabular-nums">
                {current + 1} / {pages}
              </span>
              <Button
                variant="ghost"
                size="sm"
                disabled={current >= pages - 1}
                onClick={() => setPage(current + 1)}
              >
                Next
              </Button>
            </div>
          </nav>
        </>
      )}
    </SectionCardPanel>
  )
}
