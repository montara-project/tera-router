import type { ColumnDef } from '@tanstack/react-table'

import { Link } from '@tanstack/react-router'
import { useMemo } from 'react'

import type { Models } from '@/lib/api/models'

import { HealthBadge, HealthTimeline } from '@/components/block/dashboard/overview-provider-health'
import { formatCount, formatMs } from '@/lib/format'

import { features } from '../common/react-table'
import { ProviderAvatar } from './provider-avatar'

type ColumnType = ColumnDef<typeof features, Models.Provider, unknown>

const RIGHT = { headerClassName: 'text-right', cellClassName: 'text-right tabular-nums' }

interface ProvidersColumnProps {
  /** 24h health entries keyed by provider slug */
  health: Map<string, Models.HealthEntry>
}

export function ProvidersColumn({ health }: ProvidersColumnProps) {
  return useMemo<ColumnType[]>(() => {
    // Only providers that served traffic in the window get health figures.
    const traffic = (p: Models.Provider) => {
      const h = health.get(p.slug)
      return h && h.requests > 0 ? h : undefined
    }

    return [
      {
        accessorKey: 'name',
        header: 'Provider',
        meta: { headerClassName: 'w-[30%]', cellClassName: 'max-w-0' },
        cell: ({ row }) => {
          const p = row.original
          return (
            <Link
              to="/providers/$providerId"
              params={{ providerId: p.id }}
              className="group flex min-w-0 items-center gap-2.5 rounded-sm"
            >
              <ProviderAvatar slug={p.slug} apiKind={p.api_kind} size="xs" className="size-6" />
              <span className="min-w-0">
                <span className="block truncate font-medium group-hover:underline" title={p.name}>
                  {p.name}
                </span>
                <span className="block truncate text-[11.5px] text-muted-foreground" title={p.slug}>
                  {p.slug}
                </span>
              </span>
            </Link>
          )
        },
      },
      {
        id: 'status',
        header: 'Status',
        cell: ({ row }) => {
          const t = traffic(row.original)
          return t ? (
            <HealthBadge status={t.status} />
          ) : (
            <span className="rounded-sm border border-border bg-muted/40 px-1.5 py-0.5 text-[11.5px] font-medium text-muted-foreground">
              No traffic
            </span>
          )
        },
      },
      {
        accessorKey: 'accounts',
        header: 'Accounts',
        meta: RIGHT,
        cell: ({ row }) => row.original.accounts ?? 0,
      },
      {
        id: 'timeline',
        header: 'Last 24 hours',
        meta: { headerClassName: 'w-44' },
        cell: ({ row }) => {
          const t = traffic(row.original)
          return t ? (
            <HealthTimeline entry={t} className="gap-[2px] [&>li]:h-3" />
          ) : (
            <span className="text-xs text-muted-foreground">No traffic</span>
          )
        },
      },
      {
        id: 'requests',
        header: 'Requests',
        meta: RIGHT,
        cell: ({ row }) => {
          const t = traffic(row.original)
          return t ? formatCount(t.requests) : '—'
        },
      },
      {
        id: 'success',
        header: 'Success',
        meta: RIGHT,
        cell: ({ row }) => {
          const t = traffic(row.original)
          return t ? `${t.successRate.toFixed(1)}%` : '—'
        },
      },
      {
        id: 'p95',
        header: 'p95',
        meta: RIGHT,
        cell: ({ row }) => {
          const t = traffic(row.original)
          return t && t.p95Ms > 0 ? formatMs(t.p95Ms) : '—'
        },
      },
    ]
  }, [health])
}
