import { IconPlus, IconStack2 } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useQueryState } from 'nuqs'
import { useMemo, useState } from 'react'

import EmptyState from '@/components/block/common/empty-state'
import PageHeader from '@/components/block/common/page-header'
import ReactTable from '@/components/block/common/react-table'
import SectionCardPanel from '@/components/block/common/section-card-panel'
import { ChainsColumn } from '@/components/block/traffic/chains/column'
import FilterChain, {
  type ChainFilters,
  type ChainRow,
  DEFAULT_CHAIN_FILTERS,
  filterChains,
} from '@/components/block/traffic/chains/filter'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { usePaginationQuery } from '@/hooks/use-pagination-query'
import { axiosErrorMessage } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'

export const Route = createFileRoute('/(protected)/(traffic)/chains/')({
  component: RouteComponent,
})

function RouteComponent() {
  const [filters, setFilters] = useState<ChainFilters>(DEFAULT_CHAIN_FILTERS)
  // The list arrives whole, so filtering and paging run here; the pager keeps
  // its page in ?page like the server-paged tables.
  const { offset, limit, pageIndex } = usePaginationQuery()
  const [, setPageParam] = useQueryState('page')

  // The chains endpoint returns every chain; offset/limit are not applied
  // server-side.
  const chainsQuery = useQuery(queries.chains.list({ offset: 0, limit: 100 }))
  const healthQuery = useQuery(queries.providerHealth.overview('24h'))
  const providersQuery = useQuery(queries.providers.list())

  const rows = useMemo<ChainRow[]>(() => {
    const health = new Map((healthQuery.data?.chains ?? []).map((h) => [h.name, h]))
    return (chainsQuery.data?.data ?? []).map((chain) => ({
      ...chain,
      health: health.get(chain.name),
    }))
  }, [chainsQuery.data, healthQuery.data])

  const apiKinds = useMemo(
    () =>
      new Map((providersQuery.data?.data?.connected ?? []).map((p) => [p.slug, p.api_kind ?? ''])),
    [providersQuery.data]
  )

  const columns = ChainsColumn({ apiKinds })
  const filtered = useMemo(() => filterChains(rows, filters), [rows, filters])

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
            <span className="font-normal text-muted-foreground tabular-nums">{rows.length}</span>
          </>
        }
        toolbar={
          <FilterChain
            rows={rows}
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
            total={filtered.length}
            data={filtered.slice(offset, offset + limit)}
            pageIndex={pageIndex}
            pageSize={limit}
            columns={columns}
            emptyMessage={
              <EmptyState
                icon={IconStack2}
                title={rows.length === 0 ? 'No chains yet' : 'No chains match'}
                description={
                  rows.length === 0
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
