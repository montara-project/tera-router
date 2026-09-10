import { IconPlus } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useMemo } from 'react'
import { toast } from 'sonner'

import ReactTable from '@/components/block/common/react-table'
import SectionCard from '@/components/block/common/section-card'
import { ChainColumn } from '@/components/block/traffic/chains/column'
import FilterChain from '@/components/block/traffic/chains/filter'
import { Button } from '@/components/ui/button'
import { usePaginationQuery } from '@/hooks/use-pagination-query'
import { queries } from '@/lib/api/queries'
import { getTotal } from '@/lib/constants/paginate'

export const Route = createFileRoute('/(protected)/(traffic)/chains/')({
  component: RouteComponent,
})

function RouteComponent() {
  const { offset, limit, pageIndex } = usePaginationQuery()

  const defaultQueryParams = useMemo(() => ({ offset, limit }), [offset, limit])

  const {
    data: chainData,
    isFetching,
    isLoading,
    isError,
    error,
  } = useQuery(queries.chains.list(defaultQueryParams))
  const loading = isFetching || isLoading
  const total = getTotal(chainData)

  if (isError) {
    toast.error(error?.message || 'Failed to load user chains')
  }

  const columns = ChainColumn({ loading })
  const chains = useMemo(
    () => (chainData?.data && chainData?.data?.length > 0 ? chainData.data : []),
    [chainData]
  )

  return (
    <SectionCard
      title="Chains"
      description="Build named routing paths that keep requests moving when a model or provider cannot serve them."
      toolbar={
        <Button>
          <IconPlus />
          <span>Create Chain</span>
        </Button>
      }
    >
      <div className="space-y-4">
        <FilterChain />

        <ReactTable
          total={total}
          data={chains}
          pageIndex={pageIndex}
          pageSize={limit}
          columns={columns}
        />
      </div>
    </SectionCard>
  )
}
