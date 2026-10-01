import { IconPlus } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useQueryState } from 'nuqs'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import type { Models } from '@/lib/api/models'

import ReactTable from '@/components/block/common/react-table'
import SectionCard from '@/components/block/common/section-card'
import ChainFormDialog from '@/components/block/traffic/chains/chain-form-dialog'
import { ChainColumn } from '@/components/block/traffic/chains/column'
import FilterChain from '@/components/block/traffic/chains/filter'
import { Button } from '@/components/ui/button'
import { usePaginationQuery } from '@/hooks/use-pagination-query'
import { queries } from '@/lib/api/queries'

export const Route = createFileRoute('/(protected)/(traffic)/chains/')({
  component: RouteComponent,
})

function RouteComponent() {
  const { offset, limit, pageIndex } = usePaginationQuery()
  // The pager writes ?page=<n> directly; clearing it returns to page 1.
  const [, setPageParam] = useQueryState('page')

  const [search, setSearch] = useState('')
  const [strategy, setStrategy] = useState('all')
  const [status, setStatus] = useState('all')
  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<Models.Chain | null>(null)

  // A filter change shrinks the filtered set, so a page kept from the old
  // results could be past the new last page and render empty.
  const resetPage = () => void setPageParam(null)
  const handleSearchChange = (value: string) => {
    setSearch(value)
    resetPage()
  }
  const handleStrategyChange = (value: string) => {
    setStrategy(value)
    resetPage()
  }
  const handleStatusChange = (value: string) => {
    setStatus(value)
    resetPage()
  }

  const {
    data: chainData,
    isFetching,
    isLoading,
    isError,
    error,
  } = useQuery(queries.chains.list({ offset, limit }))
  const loading = isFetching || isLoading

  useEffect(() => {
    if (isError) {
      toast.error(error?.message || 'Failed to load chains')
    }
  }, [isError, error])

  const allChains = useMemo(() => chainData?.data ?? [], [chainData])

  const filteredChains = useMemo(() => {
    const q = search.trim().toLowerCase()
    return allChains.filter((chain) => {
      if (q && !chain.name.toLowerCase().includes(q)) {
        return false
      }
      if (strategy !== 'all' && chain.strategy !== strategy) {
        return false
      }
      if (status === 'active' && !chain.enabled) {
        return false
      }
      if (status === 'inactive' && chain.enabled) {
        return false
      }
      return true
    })
  }, [allChains, search, strategy, status])

  const total = filteredChains.length
  // The chains endpoint returns the full list (offset/limit are not applied
  // server-side yet), so search/status filtering and page slicing run here.
  const pageChains = useMemo(
    () => filteredChains.slice(offset, offset + limit),
    [filteredChains, offset, limit]
  )

  const columns = ChainColumn({ loading, onEdit: setEditing })

  return (
    <SectionCard
      title="Chains"
      description="Build named routing paths that keep requests moving when a model or provider cannot serve them."
      toolbar={
        <Button onClick={() => setCreateOpen(true)}>
          <IconPlus />
          <span>Create Chain</span>
        </Button>
      }
    >
      <div className="space-y-4">
        <FilterChain
          search={search}
          onSearchChange={handleSearchChange}
          onStrategyChange={handleStrategyChange}
          onStatusChange={handleStatusChange}
        />

        <ReactTable
          total={total}
          data={pageChains}
          pageIndex={pageIndex}
          pageSize={limit}
          columns={columns}
        />
      </div>

      <ChainFormDialog open={createOpen} onOpenChange={setCreateOpen} />

      <ChainFormDialog
        open={Boolean(editing)}
        onOpenChange={(open) => {
          if (!open) {
            setEditing(null)
          }
        }}
        chain={editing}
      />
    </SectionCard>
  )
}
