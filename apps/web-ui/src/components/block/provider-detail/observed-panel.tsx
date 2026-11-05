import { IconActivity, IconCheck, IconCopy, IconSearch } from '@tabler/icons-react'
import { useState } from 'react'

import type { Models } from '@/lib/api/models'

import EmptyState from '@/components/block/common/empty-state'
import DashboardPanel from '@/components/block/dashboard/dashboard-panel'
import { Button } from '@/components/ui/button'
import { Input, InputWrapper } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
import { formatMicrosUsd } from '@/lib/currency'
import { formatCompact, formatCount, formatLatency } from '@/lib/format'

/** Models this provider actually served in the last 30 days, from usage accounting. */
export default function ObservedPanel({
  models,
  loading,
}: {
  models: Models.UsageModelAccountingRow[]
  loading: boolean
}) {
  const [search, setSearch] = useState('')
  const q = search.trim().toLowerCase()
  const rows = models.filter((m) => !q || m.model.toLowerCase().includes(q))

  const renderBody = () => {
    if (loading) {
      return (
        <div className="space-y-2 p-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
      )
    }

    if (models.length === 0) {
      return (
        <EmptyState
          className="border-0"
          icon={IconActivity}
          title="No observed models yet"
          description="Models appear here after this provider serves traffic. The Catalog tab lists every model the provider exposes."
        />
      )
    }

    if (rows.length === 0) {
      return (
        <EmptyState
          className="border-0"
          icon={IconSearch}
          title="No models match"
          description="Try a shorter name."
          action={
            <Button size="sm" variant="outline" onClick={() => setSearch('')}>
              Clear filter
            </Button>
          }
        />
      )
    }

    return (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[52rem] text-[13px]">
          <thead className="border-b border-border text-xs text-muted-foreground dark:bg-muted/40">
            <tr>
              <th className="w-[26%] px-4 py-2 text-left font-medium">Model</th>
              <th className="w-[30%] px-4 py-2 text-left font-medium">Route as</th>
              <th className="px-4 py-2 text-right font-medium">Requests</th>
              <th className="px-4 py-2 text-right font-medium">Success</th>
              <th className="px-4 py-2 text-right font-medium">Avg latency</th>
              <th className="px-4 py-2 text-right font-medium">Tokens in / out</th>
              <th className="px-4 py-2 text-right font-medium">Cost</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => (
              <ObservedRow key={m.id} model={m} />
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <DashboardPanel
      icon={IconActivity}
      title={
        <>
          Observed
          <span className="font-normal text-muted-foreground">last 30 days</span>
        </>
      }
    >
      {models.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5">
          <InputWrapper className="w-full sm:w-64">
            <IconSearch aria-hidden />
            <Input
              type="search"
              aria-label="Filter models"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter models"
            />
          </InputWrapper>
          <span className="ms-auto text-[12.5px] text-muted-foreground tabular-nums">
            {q ? `${rows.length} of ${models.length} shown` : `${models.length} shown`}
          </span>
        </div>
      )}
      {renderBody()}
    </DashboardPanel>
  )
}

function ObservedRow({ model: m }: { model: Models.UsageModelAccountingRow }) {
  const routeAs = `${m.provider}/${m.model}`
  const { copy, copied } = useCopyToClipboard()

  return (
    <tr className="border-b border-border last:border-0">
      <td className="max-w-0 px-4 py-2.5">
        <span className="block truncate font-medium" title={m.model}>
          {m.model}
        </span>
      </td>
      <td className="max-w-0 px-4 py-2.5">
        <button
          type="button"
          onClick={() => copy(routeAs)}
          aria-label={copied ? `${routeAs} copied` : `Copy ${routeAs}`}
          title={routeAs}
          className="inline-flex max-w-full items-center gap-1.5 rounded-sm text-xs text-muted-foreground hover:text-foreground"
        >
          <span className="truncate">{routeAs}</span>
          {copied ? (
            <IconCheck className="size-3 shrink-0" aria-hidden />
          ) : (
            <IconCopy className="size-3 shrink-0" aria-hidden />
          )}
        </button>
      </td>
      <td className="px-4 py-2.5 text-right tabular-nums">{formatCount(m.requests)}</td>
      <td className="px-4 py-2.5 text-right tabular-nums">{m.successPct.toFixed(1)}%</td>
      <td className="px-4 py-2.5 text-right tabular-nums">
        {m.latencyMs > 0 ? formatLatency(m.latencyMs) : '—'}
      </td>
      <td className="px-4 py-2.5 text-right text-muted-foreground tabular-nums">
        {formatCompact(m.inputTokens)} / {formatCompact(m.outputTokens)}
      </td>
      <td className="px-4 py-2.5 text-right tabular-nums">
        {m.costMicros === null ? (
          <span className="text-muted-foreground">Unpriced</span>
        ) : (
          formatMicrosUsd(m.costMicros)
        )}
      </td>
    </tr>
  )
}
