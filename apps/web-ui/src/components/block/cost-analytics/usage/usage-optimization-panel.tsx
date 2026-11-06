import { IconDownload, IconPigMoney } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'

import type { UsageRange, UsageTelemetryOverview } from '@/lib/api/models/usage'

import { Button } from '@/components/ui/button'
import { env } from '@/config/env'
import { queries } from '@/lib/api/queries'
import { formatMicrosUsd } from '@/lib/currency'
import { saveFile } from '@/lib/file'
import { formatBytes, formatCompact, formatCount } from '@/lib/format'
import { renderSavingsCard } from '@/lib/savings-card'

const RANGE_LABELS: Record<UsageRange, string> = {
  today: 'Today',
  '24h': 'Last 24 hours',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
}

/** Display names for the saving_rules keys the gateway records. */
const RULE_LABELS: Record<string, string> = {
  headroom: 'Headroom',
  ansi_escapes: 'ANSI escapes',
  trailing_whitespace: 'Trailing whitespace',
  blank_lines: 'Blank-line runs',
  repeated_lines: 'Repeated lines',
  comments: 'Source comments',
}

const DIRECTIVES = [
  {
    key: 'caveman',
    label: 'Caveman',
    hint: 'Terse output instruction',
    setting: 'caveman_enabled',
  },
  { key: 'terse', label: 'Terse', hint: 'Concise-output directive', setting: 'terse_enabled' },
  { key: 'ponytail', label: 'Ponytail', hint: 'Output trimming', setting: 'ponytail_enabled' },
] as const

/** Bytes to an approximate token count (~4 bytes per token). */
const toTokens = (bytes: number) => Math.round(bytes / 4)

export default function UsageOptimizationPanel({
  telemetry,
  range,
}: {
  telemetry: UsageTelemetryOverview
  range: UsageRange
}) {
  const { optimization, spend, traffic } = telemetry
  const { data: settings } = useQuery(queries.settings.get())
  const maxRule = optimization.rules[0]?.bytes ?? 0
  const optimizedShare =
    traffic.requests > 0 ? (optimization.optimizedRequests / traffic.requests) * 100 : 0
  const perRequest =
    optimization.optimizedRequests > 0
      ? optimization.tokensSaved / optimization.optimizedRequests
      : 0

  const stats = [
    { label: 'Value saved', value: formatMicrosUsd(spend.valueSavedMicros) },
    {
      label: 'Tokens saved',
      value: formatCompact(optimization.tokensSaved),
      detail: `${formatCompact(toTokens(optimization.rtkBytes))} RTK · ${formatCompact(toTokens(optimization.headroomBytes))} Headroom`,
    },
    {
      label: 'Optimized requests',
      value: formatCount(optimization.optimizedRequests),
      detail: `${optimizedShare.toFixed(1)}% of all requests`,
    },
    {
      label: 'Prompt reduced',
      value:
        optimization.promptReducedBytes > 0
          ? formatBytes(optimization.promptReducedBytes, 1)
          : '0 B',
      detail: `${formatCompact(Math.round(perRequest))} tokens per request`,
    },
  ]

  const handleSavingsCard = () => {
    const card = [
      { value: formatMicrosUsd(spend.valueSavedMicros), label: 'saved' },
      { value: formatCompact(optimization.tokensSaved), label: 'tokens' },
      { value: `${optimization.optimizedRequests}`, label: 'optimized' },
      { value: stats[3].value, label: 'prompt reduced' },
    ]
    renderSavingsCard(env.VITE_APP_NAME, RANGE_LABELS[range], card)
      .then((blob) => saveFile(blob, `savings-card-${range}.png`))
      .catch((error: Error) => toast.error(error.message))
  }

  return (
    <section className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card">
      <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5">
        <h2 className="flex items-center gap-2.5 text-[13px] font-semibold">
          <IconPigMoney className="text-primary size-4" stroke={1.75} aria-hidden />
          Optimization
        </h2>
        <Button variant="outline" size="sm" onClick={handleSavingsCard}>
          <IconDownload />
          Savings card
        </Button>
      </header>

      <dl className="grid gap-px border-b border-border bg-border sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="flex flex-col gap-0.5 bg-card px-4 py-3.5">
            <dt className="text-muted-foreground text-xs font-medium">{s.label}</dt>
            <dd className="text-xl font-semibold tracking-[-0.01em] tabular-nums">{s.value}</dd>
            {s.detail && <dd className="text-muted-foreground text-xs tabular-nums">{s.detail}</dd>}
          </div>
        ))}
      </dl>

      <div className="grid gap-px bg-border lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <div className="flex flex-col gap-3 bg-card p-4">
          <h3 className="text-muted-foreground text-xs font-medium">
            Compression rules · by bytes removed
          </h3>
          {optimization.rules.length === 0 ? (
            <p className="text-muted-foreground rounded-md border border-border px-4 py-6 text-center text-[13px]">
              No compression rule fired in this period.
            </p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {optimization.rules.map((r) => (
                <li
                  key={r.rule}
                  className="grid grid-cols-[9rem_minmax(0,1fr)_4.5rem] items-center gap-3 text-[13px]"
                >
                  <span className="truncate">{RULE_LABELS[r.rule] ?? r.rule}</span>
                  <span className="bg-muted h-1.5 overflow-hidden rounded-full" aria-hidden>
                    <span
                      className="bg-primary block h-full rounded-full"
                      style={{ width: `${maxRule > 0 ? (r.bytes / maxRule) * 100 : 0}%` }}
                    />
                  </span>
                  <span className="text-muted-foreground text-right text-xs tabular-nums">
                    {formatBytes(r.bytes, 1)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex flex-col gap-1 bg-card p-4">
          <h3 className="text-muted-foreground pb-1 text-xs font-medium">
            Output shaping · share of requests
          </h3>
          <ul className="divide-y divide-border">
            {DIRECTIVES.map((d) => {
              const enabled = settings?.data?.[d.setting] ?? false
              const count = optimization.directives[d.key] ?? 0
              const share = traffic.requests > 0 ? (count / traffic.requests) * 100 : 0
              return (
                <li
                  key={d.key}
                  className="flex items-center justify-between gap-3 py-2 text-[13px]"
                >
                  <span className="min-w-0 truncate">
                    <span className="font-medium">{d.label}</span>{' '}
                    <span className="text-muted-foreground text-xs">{d.hint}</span>
                  </span>
                  <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                    {enabled ? `${share.toFixed(1)}%` : 'Off'}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </section>
  )
}
