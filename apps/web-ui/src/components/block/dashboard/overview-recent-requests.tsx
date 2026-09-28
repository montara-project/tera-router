import { Link } from '@tanstack/react-router'
import { ArrowUpRight, Clock } from 'lucide-react'
import { useState } from 'react'

import type { UsageTerminalRequestRow } from '@/lib/api/models/usage'

import { Icons } from '@/components/block/common/icons'
import { fmtCompact } from '@/components/block/cost-analytics/usage/format'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

const COLUMNS = 'grid grid-cols-[0.9fr_1.8fr_1fr_0.9fr_0.9fr_0.7fr] items-center gap-4'
const PAGE_SIZE = 10

interface OverviewRecentRequestsProps {
  rows: UsageTerminalRequestRow[]
}

function fmtCost(micros: number): string {
  const dollars = micros / 1e6
  return `$${dollars.toFixed(4)}`
}

export default function OverviewRecentRequests({ rows }: OverviewRecentRequestsProps) {
  const [page, setPage] = useState(1)

  const pageCount = Math.max(Math.ceil(rows.length / PAGE_SIZE), 1)
  const safePage = Math.min(page, pageCount)
  const visible = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  return (
    <Card className="bg-background">
      <CardContent className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <Clock className="mt-0.5 h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-semibold text-foreground">Recent requests</p>
              <p className="text-muted-foreground text-xs">
                Terminal request outcomes from the selected period.
              </p>
            </div>
          </div>

          <Link
            to="/usage"
            className="inline-flex items-center gap-1 text-xs font-medium text-emerald-500 transition-colors hover:text-emerald-400"
          >
            Full accounting
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="mt-4 overflow-x-auto">
          <div className="min-w-[760px]">
            <div className={`${COLUMNS} border-b border-border pb-3`}>
              {['Status', 'Provider / Model', 'Tokens', 'Cost', 'Latency', 'Time'].map((label) => (
                <p
                  key={label}
                  className="text-muted-foreground text-[10px] font-semibold uppercase tracking-[0.12em]"
                >
                  {label}
                </p>
              ))}
            </div>

            <div className="divide-y divide-border/60">
              {visible.map((row) => {
                const totalTokens = row.inputTokens + row.outputTokens

                return (
                  <div key={row.id} className={`${COLUMNS} gap-4 py-3.5`}>
                    <div>
                      {row.status === 'success' ? (
                        <Badge variant="success" appearance="light" size="sm">
                          Success
                        </Badge>
                      ) : (
                        <Badge variant="secondary" size="sm">
                          Cancelled
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white ring-1 ring-border">
                        <Icons.chatgpt className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">{row.model}</p>
                        <p className="text-muted-foreground truncate text-xs">{row.provider}</p>
                      </div>
                    </div>

                    <div>
                      <p className="text-sm font-semibold tabular-nums text-foreground">
                        {totalTokens.toLocaleString('en-US')}
                      </p>
                      {row.reasoningTokens > 0 ? (
                        <p className="text-muted-foreground truncate text-xs">
                          {row.reasoningTokens} reasoning
                        </p>
                      ) : row.inputCacheRead > 0 ? (
                        <p className="text-muted-foreground truncate text-xs">
                          {fmtCompact(row.inputCacheRead)} cached
                        </p>
                      ) : null}
                    </div>

                    <p className="text-sm tabular-nums text-foreground">
                      {row.costMicros === null ? 'Unpriced' : fmtCost(row.costMicros)}
                    </p>

                    <p className="text-sm tabular-nums text-foreground">
                      {(row.latencyMs / 1000).toFixed(2)}s
                    </p>

                    <p className="text-muted-foreground text-xs">{row.time}</p>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
          <p className="text-muted-foreground text-xs">{rows.length} total</p>
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
