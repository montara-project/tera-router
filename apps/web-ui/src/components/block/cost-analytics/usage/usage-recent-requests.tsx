import { IconActivity, IconInfoCircle } from '@tabler/icons-react'
import { useState } from 'react'
import { toast } from 'sonner'

import type { UsageTerminalRequestRow } from '@/lib/api/models/usage'

import { Icons } from '@/components/block/common/icons'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

import { fmtCompact, fmtLatency, fmtMoney } from './format'

const COLUMNS = 'grid grid-cols-[1.1fr_1.6fr_1fr_1fr_1.1fr_1.1fr_0.7fr_0.7fr] items-center gap-4'
const PAGE_SIZE = 10

interface RecentRequestsProps {
  rows: UsageTerminalRequestRow[]
}

export default function UsageRecentRequests({ rows }: RecentRequestsProps) {
  const [page, setPage] = useState(1)

  const pageCount = Math.max(Math.ceil(rows.length / PAGE_SIZE), 1)
  const safePage = Math.min(page, pageCount)
  const visible = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const handleDetails = () => {
    toast.info('Request audit view is not wired to the backend yet')
  }

  return (
    <Card className="bg-background">
      <CardContent className="p-5">
        <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <IconActivity className="h-4 w-4 text-muted-foreground" />
          Recent terminal requests
        </p>
        <p className="text-muted-foreground mt-0.5 text-xs">
          Open a request to audit tokens, cost, pricing, and latency.
        </p>

        <div className="mt-4 overflow-x-auto">
          <div className="min-w-[900px]">
            <div className={`${COLUMNS} border-b border-border pb-3`}>
              {[
                'Status',
                'Provider / Model',
                'Input',
                'Output',
                'Cost',
                'Latency',
                'Time',
                'Detail',
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
              {visible.map((row) => (
                <div key={row.id} className={`${COLUMNS} gap-4 py-3.5`}>
                  <div className="flex flex-col items-start gap-1">
                    {row.status === 'success' ? (
                      <Badge variant="success" appearance="light" size="sm">
                        Success
                      </Badge>
                    ) : row.status === 'failed' ? (
                      <Badge variant="destructive" appearance="light" size="sm">
                        Failed
                      </Badge>
                    ) : (
                      <Badge variant="secondary" size="sm">
                        Cancelled
                      </Badge>
                    )}
                    {row.usage === 'provider' ? (
                      <Badge variant="success" appearance="light" size="sm">
                        Provider usage
                      </Badge>
                    ) : row.usage === 'estimate' ? (
                      <Badge variant="warning" appearance="light" size="sm">
                        Usage estimate
                      </Badge>
                    ) : (
                      <Badge variant="secondary" size="sm">
                        No usage reported
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white ring-1 ring-border">
                      <Icons.chatgpt className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{row.model}</p>
                      <p className="text-muted-foreground truncate font-mono text-[10px] uppercase">
                        {row.provider}
                      </p>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm tabular-nums text-foreground">
                      {fmtCompact(row.inputTokens)}
                    </p>
                    <p className="text-muted-foreground truncate text-xs">
                      {fmtCompact(row.inputCacheRead)} read · {fmtCompact(row.inputCacheWrite)}{' '}
                      write
                    </p>
                  </div>

                  <div>
                    <p className="text-sm tabular-nums text-foreground">
                      {fmtCompact(row.outputTokens)}
                    </p>
                    <p className="text-muted-foreground truncate text-xs">
                      {fmtCompact(row.reasoningTokens)} reasoning
                    </p>
                  </div>

                  <div>
                    <p className="text-sm font-semibold tabular-nums text-foreground">
                      {row.costMicros === null ? 'Unpriced' : fmtMoney(row.costMicros)}
                    </p>
                    {row.costNote ? (
                      <p className="text-muted-foreground text-xs">{row.costNote}</p>
                    ) : row.costMicros === null ? (
                      <Badge variant="destructive" appearance="light" size="sm">
                        Missing price
                      </Badge>
                    ) : null}
                  </div>

                  <div>
                    <p className="text-sm tabular-nums text-foreground">
                      {fmtLatency(row.latencyMs)}
                    </p>
                    <p className="text-muted-foreground truncate text-xs">
                      upstream {fmtLatency(row.upstreamMs)}
                    </p>
                  </div>

                  <p className="text-muted-foreground text-xs">{row.time}</p>

                  <Button variant="outline" size="xs" onClick={handleDetails}>
                    <IconInfoCircle className="h-3.5 w-3.5" />
                    Details
                  </Button>
                </div>
              ))}
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
