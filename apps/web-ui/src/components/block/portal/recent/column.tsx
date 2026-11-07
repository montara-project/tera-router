import type { ColumnDef } from '@tanstack/react-table'

import { useMemo } from 'react'

import type { PortalRequest } from '@/lib/api/models/portal'

import { FIGURE } from '@/components/block/cost-analytics/usage/figure'
import { formatMicrosUsd } from '@/lib/currency'
import { formatDateTime } from '@/lib/date'
import { formatCompact, formatKb, formatMs } from '@/lib/format'
import { cn } from '@/lib/utils'

import { features } from '../../common/react-table'
import ModelName from '../model-name'

type ColumnType = ColumnDef<typeof features, PortalRequest, unknown>

type PortalRecentColumnProps = {
  onOpen: (request: PortalRequest) => void
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

export function PortalRecentColumn({ onOpen }: PortalRecentColumnProps) {
  const columns = useMemo<ColumnType[]>(() => {
    return [
      {
        accessorKey: 'created_at',
        header: 'Time',
        meta: { headerClassName: 'w-px', cellClassName: 'whitespace-nowrap' },
        cell: ({ row }) => (
          <span className="text-muted-foreground tabular-nums">
            {formatDateTime(row.original.created_at)}
          </span>
        ),
      },
      {
        accessorKey: 'model',
        header: 'Model',
        meta: { headerClassName: 'w-[34%]', cellClassName: 'max-w-0' },
        cell: ({ row }) => (
          <ModelName
            provider={row.original.provider}
            apiKind={row.original.api_kind}
            model={row.original.model}
            onOpen={() => onOpen(row.original)}
          />
        ),
      },
      {
        id: 'tokens',
        header: 'Tokens in → out',
        meta: FIGURE,
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {formatCompact(row.original.prompt_tokens)} →{' '}
            {formatCompact(row.original.completion_tokens)}
          </span>
        ),
      },
      {
        accessorKey: 'cost_micros',
        header: 'Cost',
        meta: FIGURE,
        cell: ({ row }) => (
          <span className="text-muted-foreground">{formatMicrosUsd(row.original.cost_micros)}</span>
        ),
      },
      {
        accessorKey: 'latency_ms',
        header: 'Latency',
        meta: FIGURE,
        cell: ({ row }) => (
          <span className="text-muted-foreground">{formatMs(row.original.latency_ms)}</span>
        ),
      },
      {
        id: 'optimizations',
        header: 'Optimizations',
        cell: ({ row: { original: r } }) => {
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
            <span className="flex flex-wrap gap-1">
              {tags.length > 0 ? tags : <span className="text-muted-foreground">—</span>}
            </span>
          )
        },
      },
    ]
  }, [onOpen])

  return columns
}
