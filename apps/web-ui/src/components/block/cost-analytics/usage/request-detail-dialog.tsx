import type { ReactNode } from 'react'

import type { UsageTerminalRequestRow } from '@/lib/api/models/usage'

import { ProviderAvatar } from '@/components/block/providers/provider-avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatMicrosUsd } from '@/lib/currency'
import { formatCompact, formatDecimal, formatLatency } from '@/lib/format'

import { RequestStatusBadge, RequestUsageBadge } from './request-badges'

const SECTION_TITLE = 'text-muted-foreground text-xs font-semibold uppercase tracking-[0.14em]'

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <p className="text-muted-foreground shrink-0 text-xs">{label}</p>
      <div className="text-right text-sm font-medium tabular-nums text-foreground">{children}</div>
    </div>
  )
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-muted-foreground text-[10px] font-semibold uppercase tracking-[0.12em]">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  )
}

/** How fast this request drains the account's token budget (1:1 when unset). */
function formatBudgetDrain(rate: number | null | undefined): string {
  if (rate === undefined || rate === null) return '×1 (1:1)'
  if (rate === 0) return 'free token budget'
  return `×${formatDecimal(rate)}`
}

interface RequestDetailDialogProps {
  open: boolean
  onClose: () => void
  row: UsageTerminalRequestRow | null
}

/** Read-only audit view of one terminal request: tokens, cost and pricing,
 * and latency. Everything shown comes from the telemetry row itself. */
export default function RequestDetailDialog({ open, onClose, row }: RequestDetailDialogProps) {
  if (!row) {
    return null
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Terminal request</DialogTitle>
          <DialogDescription>
            Audit tokens, cost and pricing, and latency for this request.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <div className="flex items-center gap-3 rounded-xl border border-border p-4">
            <ProviderAvatar slug={row.provider} apiKind={row.api_kind} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">{row.model}</p>
              <p className="text-muted-foreground truncate font-mono text-[10px] uppercase">
                {row.provider}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <RequestStatusBadge status={row.status} />
              <RequestUsageBadge usage={row.usage} />
            </div>
          </div>

          <section className="space-y-3 rounded-xl border border-border p-4">
            <p className={SECTION_TITLE}>Token usage</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <StatTile label="Input" value={formatCompact(row.inputTokens)} />
              <StatTile label="Cache read" value={formatCompact(row.inputCacheRead)} />
              <StatTile label="Cache write" value={formatCompact(row.inputCacheWrite)} />
              <StatTile label="Output" value={formatCompact(row.outputTokens)} />
              <StatTile label="Reasoning" value={formatCompact(row.reasoningTokens)} />
            </div>
            <p className="text-muted-foreground text-xs">
              Input counts uncached tokens only; cache read, cache write, and reasoning are tracked
              separately.
            </p>
          </section>

          <section className="space-y-3 rounded-xl border border-border p-4">
            <p className={SECTION_TITLE}>Cost &amp; pricing</p>
            <DetailRow label="Tracked cost">
              {row.costMicros === null ? (
                <span className="inline-flex items-center gap-2">
                  Unpriced
                  <Badge variant="destructive" appearance="light" size="sm">
                    Missing price
                  </Badge>
                </span>
              ) : (
                formatMicrosUsd(row.costMicros)
              )}
            </DetailRow>
            {row.costNote ? <DetailRow label="Note">{row.costNote}</DetailRow> : null}
            <DetailRow label="Token budget drain">
              {formatBudgetDrain(row.tokenConsumptionRate)}
            </DetailRow>
            <p className="text-muted-foreground text-xs">
              The consumption rate scales how fast the account's token budget drains; cost
              accounting always uses real tokens.
            </p>
          </section>

          <div className="grid gap-4 sm:grid-cols-2">
            <section className="space-y-3 rounded-xl border border-border p-4">
              <p className={SECTION_TITLE}>Latency</p>
              <DetailRow label="Total">{formatLatency(row.latencyMs)}</DetailRow>
              <DetailRow label="Upstream">{formatLatency(row.upstreamMs)}</DetailRow>
            </section>

            <section className="space-y-3 rounded-xl border border-border p-4">
              <p className={SECTION_TITLE}>Request</p>
              <DetailRow label="Requested">{row.time}</DetailRow>
              <DetailRow label="API kind">
                <span className="font-mono text-xs">{row.api_kind ?? '—'}</span>
              </DetailRow>
              <DetailRow label="Record ID">
                <span className="font-mono text-xs">#{row.id}</span>
              </DetailRow>
            </section>
          </div>
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
