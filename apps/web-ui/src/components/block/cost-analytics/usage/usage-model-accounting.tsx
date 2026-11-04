import {
  IconArrowDown,
  IconArrowsSort,
  IconArrowUp,
  IconBrain,
  IconSearch,
} from '@tabler/icons-react'
import { useMemo, useState } from 'react'

import type { UsageModelAccountingRow } from '@/lib/api/models/usage'

import DashboardPanel from '@/components/block/dashboard/dashboard-panel'
import { ProviderAvatar } from '@/components/block/providers/provider-avatar'
import { Input } from '@/components/ui/input'
import { formatMicrosUsd } from '@/lib/currency'
import { formatCompact, formatCount, formatMs } from '@/lib/format'
import { cn } from '@/lib/utils'

type Row = UsageModelAccountingRow
type SortKey = 'model' | 'requests' | 'tokens' | 'cost' | 'latency' | 'pricing'

const tokens = (r: Row) => r.inputTokens + r.outputTokens

const COLUMNS: { key: SortKey; label: string; value: (r: Row) => number | string }[] = [
  { key: 'model', label: 'Model', value: (r) => r.model.toLowerCase() },
  { key: 'requests', label: 'Requests', value: (r) => r.requests },
  { key: 'tokens', label: 'Tokens', value: tokens },
  // Unpriced rows sort below every priced one.
  { key: 'cost', label: 'Cost', value: (r) => r.costMicros ?? -1 },
  { key: 'latency', label: 'Latency', value: (r) => r.latencyMs },
  { key: 'pricing', label: 'Pricing', value: (r) => r.coverage },
]

/** Pricing badge: nothing billable, a missing price, or the rates in use. */
function pricingBadge(r: Row): { label: string; tone: string; title?: string } {
  if (tokens(r) === 0) return { label: 'No billable usage', tone: 'text-muted-foreground' }
  if (r.costMicros === null)
    return { label: 'Missing price', tone: 'text-red-700 dark:text-red-400' }
  return { label: 'Priced', tone: 'text-foreground/80', title: r.pricingRates ?? undefined }
}

/** Right-aligned two-line cell: main figure over a muted detail. */
function Figure({ value, detail }: { value: string; detail: string }) {
  return (
    <td className="px-4 py-3 text-right align-top whitespace-nowrap tabular-nums">
      <div className="text-[13px]">{value}</div>
      <div className="text-muted-foreground text-[11.5px]">{detail}</div>
    </td>
  )
}

export default function UsageModelAccounting({ rows }: { rows: Row[] }) {
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: 'cost', desc: true })

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase()
    const value = COLUMNS.find((c) => c.key === sort.key)!.value
    return rows
      .filter(
        (r) =>
          !query ||
          r.model.toLowerCase().includes(query) ||
          r.provider.toLowerCase().includes(query)
      )
      .sort((a, b) => {
        const [x, y] = [value(a), value(b)]
        const order = x < y ? -1 : x > y ? 1 : 0
        return sort.desc ? -order : order
      })
  }, [rows, search, sort])

  const toggle = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, desc: !s.desc } : { key, desc: key !== 'model' }))

  return (
    <DashboardPanel
      title="Model accounting"
      icon={IconBrain}
      toolbar={
        <div className="relative w-full sm:w-64">
          <IconSearch
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
            stroke={1.75}
            aria-hidden
          />
          <Input
            value={search}
            placeholder="Filter provider or model"
            aria-label="Filter provider or model"
            className="h-8 pl-8 text-[13px]"
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      }
    >
      {visible.length === 0 ? (
        <p className="text-muted-foreground p-4 text-sm">
          {rows.length === 0
            ? 'No model traffic in this period.'
            : `No models match "${search.trim()}".`}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[56rem]">
            <thead className="text-muted-foreground border-b border-border text-xs dark:bg-muted/40">
              <tr>
                {COLUMNS.map((c) => {
                  const active = sort.key === c.key
                  const Arrow = !active ? IconArrowsSort : sort.desc ? IconArrowDown : IconArrowUp
                  return (
                    <th
                      key={c.key}
                      aria-sort={active ? (sort.desc ? 'descending' : 'ascending') : undefined}
                      className={cn(
                        'px-4 py-2 font-medium',
                        c.key === 'model' ? 'w-[34%] text-left' : 'text-right'
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => toggle(c.key)}
                        className={cn(
                          'inline-flex h-6 items-center gap-1 rounded-sm hover:text-foreground',
                          c.key !== 'model' && 'flex-row-reverse',
                          active && 'text-foreground'
                        )}
                      >
                        {c.label}
                        <Arrow className="size-3" aria-hidden />
                      </button>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => {
                const badge = pricingBadge(row)
                return (
                  <tr key={row.id} className="border-b border-border last:border-0">
                    <td className="max-w-0 px-4 py-3">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <ProviderAvatar
                          slug={row.provider}
                          apiKind={row.api_kind}
                          size="xs"
                          className="size-[22px] rounded-[4px]"
                        />
                        <div className="min-w-0">
                          <p className="truncate font-mono text-[12.5px]" title={row.model}>
                            {row.model}
                          </p>
                          <p
                            className="text-muted-foreground truncate text-[11.5px]"
                            title={row.provider}
                          >
                            {row.provider}
                          </p>
                        </div>
                      </div>
                    </td>
                    <Figure
                      value={formatCount(row.requests)}
                      detail={`${row.successPct.toFixed(1)}% ok`}
                    />
                    <Figure
                      value={formatCompact(tokens(row))}
                      detail={`${formatCompact(row.inputTokens)} in · ${formatCompact(row.outputTokens)} out`}
                    />
                    <Figure
                      value={row.costMicros === null ? '—' : formatMicrosUsd(row.costMicros)}
                      detail={`${formatMicrosUsd(row.savedMicros)} saved`}
                    />
                    <Figure
                      value={row.latencyMs > 0 ? formatMs(row.latencyMs) : '—'}
                      detail={`TTFT ${row.ttftMs > 0 ? formatMs(row.ttftMs) : '—'}`}
                    />
                    <td className="px-4 py-2.5 text-right align-top whitespace-nowrap">
                      <span
                        className={cn(
                          'inline-flex h-5 items-center rounded-sm border border-border px-1.5 text-[11.5px] font-medium dark:bg-muted/40',
                          badge.tone
                        )}
                        title={badge.title}
                      >
                        {badge.label}
                      </span>
                      <div className="text-muted-foreground mt-1 text-[11.5px] tabular-nums">
                        {tokens(row) === 0 ? '—' : `${row.coverage.toFixed(0)}%`} covered
                      </div>
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
