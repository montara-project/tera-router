import { IconPlus } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useQueryState } from 'nuqs'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import type { Models } from '@/lib/api/models'

import ReactTable from '@/components/block/common/react-table'
import SectionCard from '@/components/block/common/section-card'
import { PricingColumn } from '@/components/block/traffic/pricing/column'
import FilterPricing from '@/components/block/traffic/pricing/filter'
import OverrideDialog from '@/components/block/traffic/pricing/override-dialog'
import { Button } from '@/components/ui/button'
import { usePaginationQuery } from '@/hooks/use-pagination-query'
import { queries } from '@/lib/api/queries'

export const Route = createFileRoute('/(protected)/(traffic)/pricing/')({
  component: PricingRoute,
})

function PricingRoute() {
  const { offset, limit, pageIndex } = usePaginationQuery()
  // The pager writes ?page=<n> directly; clearing it returns to page 1.
  const [, setPageParam] = useQueryState('page')

  const [search, setSearch] = useState('')
  const [scope, setScope] = useState('all')
  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<Models.PricingOverride | null>(null)

  // A filter change shrinks the filtered set, so a page kept from the old
  // results could be past the new last page and render empty.
  const resetPage = () => void setPageParam(null)
  const handleSearchChange = (value: string) => {
    setSearch(value)
    resetPage()
  }
  const handleScopeChange = (value: string) => {
    setScope(value)
    resetPage()
  }

  const { data, isFetching, isLoading, isError, error } = useQuery(queries.overrides.pricingList())
  const loading = isFetching || isLoading

  useEffect(() => {
    if (isError) {
      toast.error(error?.message || 'Failed to load pricing overrides')
    }
  }, [isError, error])

  // The dialog's provider picker needs the full catalog tiles; the table
  // itself runs off the overrides list alone.
  const providersQuery = useQuery(queries.providers.list())
  const overview = providersQuery.data?.data
  const providers = [...(overview?.connected ?? []), ...(overview?.available ?? [])]

  const allOverrides = useMemo(() => data?.data ?? [], [data])

  const filteredOverrides = useMemo(() => {
    const q = search.trim().toLowerCase()
    return allOverrides.filter((row) => {
      if (q && !`${row.provider} ${row.model}`.toLowerCase().includes(q)) {
        return false
      }
      if (scope === 'model' && row.model === '') {
        return false
      }
      if (scope === 'provider' && row.model !== '') {
        return false
      }
      return true
    })
  }, [allOverrides, search, scope])

  const total = filteredOverrides.length
  // The overrides endpoint returns the full list, so search/scope filtering
  // and page slicing run here.
  const pageOverrides = useMemo(
    () => filteredOverrides.slice(offset, offset + limit),
    [filteredOverrides, offset, limit]
  )

  const columns = PricingColumn({ loading, onEdit: setEditing })

  const dialogOpen = createOpen || Boolean(editing)
  const closeDialog = () => {
    setCreateOpen(false)
    setEditing(null)
  }

  return (
    <SectionCard
      title="Model Pricing"
      description="Per-model token rates the gateway charges with. Overrides beat the built-in catalog; a provider-wide override prices every model without a specific row."
      toolbar={
        <Button onClick={() => setCreateOpen(true)}>
          <IconPlus />
          <span>Add Override</span>
        </Button>
      }
    >
      <div className="space-y-4">
        <FilterPricing
          search={search}
          onSearchChange={handleSearchChange}
          onScopeChange={handleScopeChange}
        />

        <ReactTable
          total={total}
          data={pageOverrides}
          pageIndex={pageIndex}
          pageSize={limit}
          columns={columns}
        />

        <div className="rounded-xl border border-border bg-background p-4 text-xs text-muted-foreground">
          <p className="font-semibold text-foreground">Resolution order</p>
          <p className="mt-1">
            Per-model override → provider-wide override → built-in static catalog → zero (free). A 0
            / 0 override marks a model &ldquo;free&rdquo; on purpose, and edits apply on the next
            request — no restart.
          </p>
        </div>
      </div>

      <OverrideDialog
        key={editing?.id ?? 'create'}
        open={dialogOpen}
        onClose={closeDialog}
        override={editing}
        providers={providers}
      />
    </SectionCard>
  )
}
