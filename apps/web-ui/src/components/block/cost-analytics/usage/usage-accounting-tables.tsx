import { IconListDetails, IconStack2 } from '@tabler/icons-react'
import { ArrowUpDown } from 'lucide-react'
import { useMemo, useState } from 'react'

import type { UsageModelAccountingRow, UsageProviderAccountingRow } from '@/lib/api/models/usage'

import { Icons } from '@/components/block/common/icons'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

import { fmtCompact, fmtLatency, fmtMoney } from './format'

function AvatarCell() {
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white ring-1 ring-border">
      <Icons.chatgpt className="h-4 w-4" />
    </span>
  )
}

const PROVIDER_COLUMNS =
  'grid grid-cols-[1.8fr_0.9fr_1.25fr_1.15fr_1fr_0.9fr_1.5fr] items-center gap-4'

export function ProviderAccountingTable({ rows }: { rows: UsageProviderAccountingRow[] }) {
  return (
    <Card className="bg-background">
      <CardContent className="p-5">
        <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <IconListDetails className="h-4 w-4 text-muted-foreground" />
          Provider accounting
        </p>
        <p className="text-muted-foreground mt-0.5 text-xs">
          Requests, tokens, cost, latency, and pricing by provider.
        </p>

        <div className="mt-4 overflow-x-auto">
          <div className="min-w-[860px]">
            <div className={`${PROVIDER_COLUMNS} border-b border-border pb-3`}>
              {[
                'Provider',
                'Requests',
                'Input classes',
                'Output classes',
                'Cost / Savings',
                'Latency',
                'Pricing',
              ].map((label) => (
                <p
                  key={label}
                  className="text-muted-foreground text-[10px] font-semibold uppercase tracking-[0.12em]"
                >
                  {label}
                </p>
              ))}
            </div>

            <div className="divide-y divide-border/60">
              {rows.map((row) => (
                <div key={row.id} className={`${PROVIDER_COLUMNS} gap-4 py-4`}>
                  <div className="flex items-center gap-3">
                    <AvatarCell />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {row.provider}
                      </p>
                      <p className="text-muted-foreground truncate text-xs">{row.slug}</p>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-semibold tabular-nums text-foreground">
                      {row.requests}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {row.failed} failed · {row.successPct}%
                    </p>
                  </div>

                  <div>
                    <p className="text-sm tabular-nums text-foreground">
                      {fmtCompact(row.inputTokens)} input
                    </p>
                    <p className="text-muted-foreground truncate text-xs">
                      {fmtCompact(row.cacheReadTokens)} cache read ·{' '}
                      {fmtCompact(row.cacheWriteTokens)} write
                    </p>
                  </div>

                  <div>
                    <p className="text-sm tabular-nums text-foreground">
                      {fmtCompact(row.outputTokens)} output
                    </p>
                    <p className="text-muted-foreground truncate text-xs">
                      {fmtCompact(row.reasoningTokens)} reasoning subset
                    </p>
                  </div>

                  <div>
                    <p className="text-sm font-semibold tabular-nums text-foreground">
                      {fmtMoney(row.costMicros)}
                    </p>
                    <p className="text-xs tabular-nums text-emerald-500">
                      {fmtMoney(row.savedMicros)} saved
                    </p>
                  </div>

                  <div>
                    <p className="text-sm tabular-nums text-foreground">
                      {fmtLatency(row.latencyMs)}
                    </p>
                    <p className="text-muted-foreground truncate text-xs">
                      TTFT {fmtLatency(row.ttftMs)}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm font-semibold tabular-nums text-foreground">
                      {row.coverage}%
                    </p>
                    <p className="text-muted-foreground text-[10px] leading-relaxed">
                      {row.pricingEst} / {row.pricingEligible} pricing-eligible
                      <br />
                      {row.pricingEst} pricing est. · {row.usageEst} usage est.
                      <br />
                      {row.legacy} legacy · {row.backfilled} backfilled
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

const MODEL_COLUMNS = 'grid grid-cols-[1.8fr_0.9fr_1.35fr_1fr_0.9fr_1.5fr] items-center gap-4'
const PAGE_SIZE = 10

export function ModelAccountingTable({ rows }: { rows: UsageModelAccountingRow[] }) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return rows
    return rows.filter(
      (row) => row.model.toLowerCase().includes(query) || row.provider.toLowerCase().includes(query)
    )
  }, [rows, search])

  const pageCount = Math.max(Math.ceil(filtered.length / PAGE_SIZE), 1)
  const safePage = Math.min(page, pageCount)
  const visible = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const handleSearch = (value: string) => {
    setSearch(value)
    setPage(1)
  }

  return (
    <Card className="bg-background">
      <CardContent className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <IconStack2 className="h-4 w-4 text-muted-foreground" />
              Model accounting
            </p>
            <p className="text-muted-foreground mt-0.5 text-xs">
              Usage, cost, and immutable pricing snapshots by model.
            </p>
          </div>

          <Input
            value={search}
            placeholder="Search provider or model..."
            aria-label="Search provider or model"
            className="w-full sm:w-64"
            onChange={(event) => handleSearch(event.target.value)}
          />
        </div>

        <div className="mt-4 overflow-x-auto">
          <div className="min-w-[860px]">
            <div className={`${MODEL_COLUMNS} border-b border-border pb-3`}>
              {['Provider / model', 'Requests', 'Tokens', 'Cost', 'Latency', 'Pricing'].map(
                (label) => (
                  <p
                    key={label}
                    className="text-muted-foreground flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.12em]"
                  >
                    {label}
                    <ArrowUpDown className="h-3 w-3 opacity-60" />
                  </p>
                )
              )}
            </div>

            <div className="divide-y divide-border/60">
              {visible.map((row) => (
                <div key={row.id} className={`${MODEL_COLUMNS} gap-4 py-4`}>
                  <div className="flex items-center gap-3">
                    <AvatarCell />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{row.model}</p>
                      <p className="text-muted-foreground truncate font-mono text-[10px] uppercase">
                        {row.provider}
                      </p>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-semibold tabular-nums text-foreground">
                      {row.requests}
                    </p>
                    <p className="text-muted-foreground text-xs">{row.successPct}% success</p>
                  </div>

                  <div>
                    <p className="text-sm font-semibold tabular-nums text-foreground">
                      {fmtCompact(row.inputTokens + row.outputTokens)}
                    </p>
                    <p className="text-muted-foreground truncate text-xs">
                      {fmtCompact(row.inputTokens)} in · {fmtCompact(row.outputTokens)} out
                    </p>
                    <p className="text-muted-foreground truncate text-xs">
                      {fmtCompact(row.cachedTokens)} cached · {fmtCompact(row.reasoningTokens)}{' '}
                      reasoning
                    </p>
                  </div>

                  <div>
                    <p className="text-sm font-semibold tabular-nums text-foreground">
                      {row.costMicros === null ? 'Unpriced' : fmtMoney(row.costMicros)}
                    </p>
                    {row.costMicros === null ? (
                      <Badge variant="destructive" appearance="light" size="sm">
                        Missing price
                      </Badge>
                    ) : (
                      <p className="text-xs tabular-nums text-emerald-500">
                        {fmtMoney(row.savedMicros)} saved
                      </p>
                    )}
                  </div>

                  <div>
                    <p className="text-sm tabular-nums text-foreground">
                      {fmtLatency(row.latencyMs)}
                    </p>
                    <p className="text-muted-foreground truncate text-xs">
                      TTFT {fmtLatency(row.ttftMs)}
                    </p>
                  </div>

                  <div>
                    {row.hasPricingKey ? (
                      <Badge variant="warning" appearance="light" size="sm">
                        Pricing estimate
                      </Badge>
                    ) : (
                      <Badge variant="destructive" appearance="light" size="sm">
                        Missing price
                      </Badge>
                    )}
                    <p className="text-muted-foreground mt-1 text-[10px] leading-relaxed">
                      {row.coverage}% covered
                      <br />
                      {row.pricingEst} / {row.pricingEligible} pricing-eligible
                      <br />
                      {row.pricingEst} pricing est. · {row.usageEst} usage est.
                      <br />
                      {row.legacy} legacy · {row.backfilled} backfilled
                    </p>
                    {row.pricingRates ? (
                      <p className="text-muted-foreground mt-1 text-[10px] leading-relaxed">
                        {row.pricingRates}
                      </p>
                    ) : (
                      <p className="text-muted-foreground mt-1 text-[10px] leading-relaxed">
                        No pricing key. Rates unavailable
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
          <p className="text-muted-foreground text-xs">{filtered.length} total</p>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={safePage <= 1}
              onClick={() => setPage((current) => Math.max(current - 1, 1))}
            >
              Previous
            </Button>
            <span className="text-muted-foreground text-xs tabular-nums">
              {safePage} / {pageCount}
            </span>
            <Button
              variant="ghost"
              size="sm"
              disabled={safePage >= pageCount}
              onClick={() => setPage((current) => Math.min(current + 1, pageCount))}
            >
              Next
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
