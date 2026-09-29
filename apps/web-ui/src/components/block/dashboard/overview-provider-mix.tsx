import { IconServer2 } from '@tabler/icons-react'
import { useState } from 'react'

import type { UsageProviderAccountingRow } from '@/lib/api/models/usage'

import { fmtLatency, fmtMoney } from '@/components/block/cost-analytics/usage/format'
import { ProviderAvatar } from '@/components/block/providers/provider-avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

const PAGE_SIZE = 5

interface OverviewProviderMixProps {
  rows: UsageProviderAccountingRow[]
}

export default function OverviewProviderMix({ rows }: OverviewProviderMixProps) {
  const [page, setPage] = useState(1)

  const totalRequests = rows.reduce((sum, row) => sum + row.requests, 0)
  const pageCount = Math.max(Math.ceil(rows.length / PAGE_SIZE), 1)
  const safePage = Math.min(page, pageCount)
  const visible = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  return (
    <Card className="flex h-full flex-col bg-background">
      <CardContent className="flex grow flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <IconServer2 className="h-4 w-4 text-muted-foreground" />
            Provider mix
          </p>
          <p className="text-muted-foreground text-xs">{rows.length} providers</p>
        </div>
        <p className="text-muted-foreground mt-0.5 text-xs">Traffic share and delivery quality.</p>

        <div className="mt-5 grow space-y-5">
          {visible.map((row) => {
            const share = totalRequests > 0 ? (row.requests / totalRequests) * 100 : 0

            return (
              <div key={row.id}>
                <div className="flex items-center gap-3">
                  <ProviderAvatar slug={row.slug} apiKind={row.api_kind} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{row.provider}</p>
                    <p className="text-muted-foreground truncate text-xs">
                      {row.successPct}% success · {fmtLatency(row.latencyMs)} avg
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold text-foreground">{row.requests} req</p>
                    <p className="text-muted-foreground text-xs">{fmtMoney(row.costMicros)}</p>
                  </div>
                </div>

                <div className="mt-2 flex items-center gap-3">
                  <div
                    className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted"
                    role="img"
                    aria-label={`${row.provider}: ${share.toFixed(1)}% of traffic`}
                  >
                    <div className="h-full bg-amber-500" style={{ width: `${share}%` }} />
                  </div>
                  <span className="shrink-0 text-xs font-medium tabular-nums text-foreground">
                    {share.toFixed(1)}%
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
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
