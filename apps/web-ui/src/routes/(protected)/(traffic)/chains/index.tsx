import { IconPlus, IconStack2 } from '@tabler/icons-react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useQueryState } from 'nuqs'
import { useMemo, useState } from 'react'

import EmptyState from '@/components/block/common/empty-state'
import PageHeader from '@/components/block/common/page-header'
import ReactTable from '@/components/block/common/react-table'
import SectionCardPanel from '@/components/block/common/section-card-panel'
import { ChainsColumn } from '@/components/block/traffic/chains/column'
import FilterChain, {
  type ChainCounts,
  type ChainFilters,
  DEFAULT_CHAIN_FILTERS,
} from '@/components/block/traffic/chains/filter'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useDebounce } from '@/hooks/use-debounce'
import { usePaginationQuery } from '@/hooks/use-pagination-query'
import { axiosErrorMessage } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'

export const Route = createFileRoute('/(protected)/(traffic)/chains/')({
  component: RouteComponent,
})

function RouteComponent() {
  const [filters, setFilters] = useState<ChainFilters>(DEFAULT_CHAIN_FILTERS)
  // The server searches, filters and pages the chains, and attaches each
  // one's 24h health; the pager keeps its page in ?page.
  const { offset, limit, pageIndex } = usePaginationQuery()
  const [, setPageParam] = useQueryState('page')
  const search = useDebounce({ value: filters.search.trim(), delay: 300 })

  const chainsQuery = useQuery({
    ...queries.chains.list({
      offset,
      limit,
      health_window: '24h',
      search: search || undefined,
      strategy: filters.strategy === 'all' ? undefined : filters.strategy,
      health: filters.health === 'all' ? undefined : filters.health,
    }),
    placeholderData: keepPreviousData,
  })
  const providersQuery = useQuery(queries.providers.list())

  const rows = chainsQuery.data?.data ?? []
  const meta = chainsQuery.data?.metadata
  const total = meta?.total ?? 0
  // The filter labels count every chain, whatever filter is applied.
  const counts = useMemo<ChainCounts>(() => {
    const out: ChainCounts = { all: Number(meta?.total_all ?? 0), strategy: {}, health: {} }
    for (const [key, value] of Object.entries(meta ?? {})) {
      if (key.startsWith('count_strategy_')) out.strategy[key.slice(15)] = Number(value)
      if (key.startsWith('count_health_')) out.health[key.slice(13)] = Number(value)
    }
    return out
  }, [meta])

  const apiKinds = useMemo(
    () =>
      new Map((providersQuery.data?.data?.connected ?? []).map((p) => [p.slug, p.api_kind ?? ''])),
    [providersQuery.data]
  )

  const columns = ChainsColumn({ apiKinds })

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={IconStack2}
        title="Chains"
        description={
          <>
            Fallback routes you call as{' '}
            <code className="font-mono text-xs">chain:&lt;name&gt;</code>.
          </>
        }
        actions={
          <Button asChild>
            <Link to="/chains/new">
              <IconPlus />
              <span>New chain</span>
            </Link>
          </Button>
        }
      />

      <SectionCardPanel
        icon={IconStack2}
        title={
          <>
            All chains
            <span className="font-normal text-muted-foreground tabular-nums">{counts.all}</span>
          </>
        }
        toolbar={
          <FilterChain
            counts={counts}
            filters={filters}
            onChange={(patch) => {
              setFilters((prev) => ({ ...prev, ...patch }))
              void setPageParam(null)
            }}
          />
        }
      >
        {chainsQuery.isError ? (
          <EmptyState
            icon={IconStack2}
            title="Couldn't load chains"
            description={axiosErrorMessage(chainsQuery.error)}
            action={
              <Button variant="outline" onClick={() => void chainsQuery.refetch()}>
                Try again
              </Button>
            }
            className="py-10"
          />
        ) : chainsQuery.isLoading ? (
          <div className="flex flex-col gap-2 p-4" aria-busy>
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        ) : (
          <ReactTable
            total={total}
            data={rows}
            pageIndex={pageIndex}
            pageSize={limit}
            columns={columns}
            emptyMessage={
              <EmptyState
                icon={IconStack2}
                title={counts.all === 0 ? 'No chains yet' : 'No chains match'}
                description={
                  counts.all === 0
                    ? 'Create a chain to route one model name through fallback models.'
                    : 'Try a different search, strategy or health filter.'
                }
                className="py-10"
              />
            }
          />
        )}
      </SectionCardPanel>
    </div>
  )
}
