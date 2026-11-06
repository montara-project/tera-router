import type { ColumnDef } from '@tanstack/react-table'

import {
  IconArrowDown,
  IconArrowsSort,
  IconArrowUp,
  IconBrain,
  IconSearch,
} from '@tabler/icons-react'
import { useQueryState } from 'nuqs'
import { useMemo, useState } from 'react'

import type { UsageModelAccountingRow } from '@/lib/api/models/usage'

import EmptyState from '@/components/block/common/empty-state'
import ReactTable, { features } from '@/components/block/common/react-table'
import DashboardPanel from '@/components/block/dashboard/dashboard-panel'
import { ProviderAvatar } from '@/components/block/providers/provider-avatar'
import { Input, InputWrapper } from '@/components/ui/input'
import { usePaginationQuery } from '@/hooks/use-pagination-query'
import { formatMicrosUsd } from '@/lib/currency'
import { formatCompact, formatCount, formatMs } from '@/lib/format'
import { cn } from '@/lib/utils'

import { Figure, FIGURE } from './figure'

type Row = UsageModelAccountingRow
type SortKey = 'model' | 'requests' | 'tokens' | 'cost' | 'latency' | 'pricing'
type Sort = { key: SortKey; desc: boolean }
type ColumnType = ColumnDef<typeof features, Row, unknown>

const PAGE_SIZES = [10, 25, 50, 100]

const tokens = (r: Row) => r.inputTokens + r.outputTokens

const SORT_VALUES: Record<SortKey, (r: Row) => number | string> = {
  model: (r) => r.model.toLowerCase(),
  requests: (r) => r.requests,
  tokens,
  // Unpriced rows sort below every priced one.
  cost: (r) => r.costMicros ?? -1,
  latency: (r) => r.latencyMs,
  pricing: (r) => r.coverage,
}

/** Pricing badge: nothing billable, a missing price, or the rates in use. */
function pricingBadge(r: Row): { label: string; tone: string; title?: string } {
  if (tokens(r) === 0) return { label: 'No billable usage', tone: 'text-muted-foreground' }
  if (r.costMicros === null)
    return { label: 'Missing price', tone: 'text-red-700 dark:text-red-400' }
  return { label: 'Priced', tone: 'text-foreground/80', title: r.pricingRates ?? undefined }
}

/** Header button that sorts by its column; numbers start descending. */
function SortHeader({
  label,
  column,
  sort,
  onSort,
}: {
  label: string
  column: SortKey
  sort: Sort
  onSort: (key: SortKey) => void
}) {
  const active = sort.key === column
  const Arrow = !active ? IconArrowsSort : sort.desc ? IconArrowDown : IconArrowUp
  return (
    <button
      type="button"
      onClick={() => onSort(column)}
      aria-label={`Sort by ${label}${active ? (sort.desc ? ', descending' : ', ascending') : ''}`}
      className={cn(
        'inline-flex h-6 items-center gap-1 rounded-sm hover:text-foreground',
        column !== 'model' && 'flex-row-reverse',
        active && 'text-foreground'
      )}
    >
      {label}
      <Arrow className="size-3" aria-hidden />
    </button>
  )
}

function modelColumns(sort: Sort, onSort: (key: SortKey) => void): ColumnType[] {
  const header = (label: string, column: SortKey) => () => (
    <SortHeader label={label} column={column} sort={sort} onSort={onSort} />
  )
  return [
    {
      accessorKey: 'model',
      header: header('Model', 'model'),
      meta: { headerClassName: 'w-[34%]', cellClassName: 'max-w-0' },
      cell: ({ row: { original: row } }) => (
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
            <p className="text-muted-foreground truncate text-[11.5px]" title={row.provider}>
              {row.provider}
            </p>
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'requests',
      header: header('Requests', 'requests'),
      meta: FIGURE,
      cell: ({ row: { original: row } }) => (
        <Figure value={formatCount(row.requests)} detail={`${row.successPct.toFixed(1)}% ok`} />
      ),
    },
    {
      id: 'tokens',
      header: header('Tokens', 'tokens'),
      meta: FIGURE,
      cell: ({ row: { original: row } }) => (
        <Figure
          value={formatCompact(tokens(row))}
          detail={`${formatCompact(row.inputTokens)} in · ${formatCompact(row.outputTokens)} out`}
        />
      ),
    },
    {
      accessorKey: 'costMicros',
      header: header('Cost', 'cost'),
      meta: FIGURE,
      cell: ({ row: { original: row } }) => (
        <Figure
          value={row.costMicros === null ? '—' : formatMicrosUsd(row.costMicros)}
          detail={`${formatMicrosUsd(row.savedMicros)} saved`}
        />
      ),
    },
    {
      accessorKey: 'latencyMs',
      header: header('Latency', 'latency'),
      meta: FIGURE,
      cell: ({ row: { original: row } }) => (
        <Figure
          value={row.latencyMs > 0 ? formatMs(row.latencyMs) : '—'}
          detail={`TTFT ${row.ttftMs > 0 ? formatMs(row.ttftMs) : '—'}`}
        />
      ),
    },
    {
      accessorKey: 'coverage',
      header: header('Pricing', 'pricing'),
      meta: {
        headerClassName: 'text-right',
        cellClassName: 'text-right align-top whitespace-nowrap',
      },
      cell: ({ row: { original: row } }) => {
        const badge = pricingBadge(row)
        return (
          <>
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
          </>
        )
      },
    },
  ]
}

export default function UsageModelAccounting({ rows }: { rows: Row[] }) {
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<Sort>({ key: 'cost', desc: true })
  // The list arrives whole, so filtering, sorting and paging run here.
  const { offset, limit, pageIndex } = usePaginationQuery({ defaultLimit: PAGE_SIZES[0] })
  const [, setPageParam] = useQueryState('page')

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase()
    const value = SORT_VALUES[sort.key]
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

  const columns = useMemo(
    () =>
      modelColumns(sort, (key) => {
        setSort((s) => (s.key === key ? { key, desc: !s.desc } : { key, desc: key !== 'model' }))
        void setPageParam(null)
      }),
    [sort, setPageParam]
  )

  return (
    <DashboardPanel
      title="Model accounting"
      icon={IconBrain}
      toolbar={
        <InputWrapper className="w-full sm:w-64">
          <IconSearch aria-hidden />
          <Input
            type="search"
            value={search}
            placeholder="Filter provider or model"
            aria-label="Filter provider or model"
            onChange={(e) => {
              setSearch(e.target.value)
              void setPageParam(null)
            }}
          />
        </InputWrapper>
      }
    >
      <ReactTable
        data={visible.slice(offset, offset + limit)}
        total={visible.length}
        pageIndex={pageIndex}
        pageSize={limit}
        pageSizes={PAGE_SIZES}
        columns={columns}
        tableClassName="min-w-[56rem]"
        emptyMessage={
          <EmptyState
            icon={IconBrain}
            title={rows.length === 0 ? 'No model traffic' : 'No models match'}
            description={
              rows.length === 0
                ? 'No model served requests in this period.'
                : `Nothing matches "${search.trim()}".`
            }
            className="py-8"
          />
        }
      />
    </DashboardPanel>
  )
}
