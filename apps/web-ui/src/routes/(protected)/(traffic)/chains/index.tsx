import { IconPlus, IconStack2 } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import PageHeader from '@/components/block/common/page-header'
import ChainsTable from '@/components/block/traffic/chains/chains-table'
import FilterChain, {
  type ChainFilters,
  type ChainRow,
  DEFAULT_CHAIN_FILTERS,
  filterChains,
} from '@/components/block/traffic/chains/filter'
import { Button } from '@/components/ui/button'
import { queries } from '@/lib/api/queries'

export const Route = createFileRoute('/(protected)/(traffic)/chains/')({
  component: RouteComponent,
})

function RouteComponent() {
  const [filters, setFilters] = useState<ChainFilters>(DEFAULT_CHAIN_FILTERS)

  // The chains endpoint returns every chain; offset/limit are not applied
  // server-side, so filtering runs here.
  const chainsQuery = useQuery(queries.chains.list({ offset: 0, limit: 100 }))
  const healthQuery = useQuery(queries.providerHealth.overview('24h'))
  const providersQuery = useQuery(queries.providers.list())

  useEffect(() => {
    if (chainsQuery.isError) {
      toast.error(chainsQuery.error?.message || 'Failed to load chains')
    }
  }, [chainsQuery.isError, chainsQuery.error])

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

  const filtered = useMemo(() => filterChains(rows, filters), [rows, filters])

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={IconStack2}
        iconClassName="text-primary border-transparent bg-primary/10"
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

      <div className="flex flex-col gap-4">
        <FilterChain
          rows={rows}
          filters={filters}
          onChange={(patch) => setFilters((prev) => ({ ...prev, ...patch }))}
        />
        <ChainsTable
          rows={filtered}
          total={rows.length}
          loading={chainsQuery.isLoading}
          apiKinds={apiKinds}
        />
      </div>
    </div>
  )
}
