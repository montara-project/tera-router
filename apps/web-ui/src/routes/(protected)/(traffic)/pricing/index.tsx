import { IconCurrencyDollar, IconPlus } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useQueryState } from 'nuqs'
import { useState } from 'react'

import type { Models } from '@/lib/api/models'

import EmptyState from '@/components/block/common/empty-state'
import PageHeader from '@/components/block/common/page-header'
import ReactTable from '@/components/block/common/react-table'
import DashboardPanel from '@/components/block/dashboard/dashboard-panel'
import { PricingColumn } from '@/components/block/traffic/pricing/column'
import FilterPricing, { type PricingScope } from '@/components/block/traffic/pricing/filter'
import OverrideDialog from '@/components/block/traffic/pricing/override-dialog'
import { Button } from '@/components/ui/button'
import { useDebounce } from '@/hooks/use-debounce'
import { usePaginationQuery } from '@/hooks/use-pagination-query'
import { axiosErrorMessage } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'
import { getTotal } from '@/lib/constants/paginate'

export const Route = createFileRoute('/(protected)/(traffic)/pricing/')({
  component: PricingRoute,
})

function PricingRoute() {
  const { offset, limit, pageIndex } = usePaginationQuery()
  // The pager writes ?page=<n> directly; clearing it returns to page 1.
  const [, setPageParam] = useQueryState('page')

  const [search, setSearch] = useState('')
  const [scope, setScope] = useState<PricingScope>('all')
  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<Models.PricingOverride | null>(null)

  // A filter change shrinks the filtered set, so a page kept from the old
  // results could be past the new last page and render empty.
  const resetPage = () => void setPageParam(null)

  // Search and scope filter server-side before paging; the debounce keeps
  // typing from firing one request per keystroke.
  const debouncedSearch = useDebounce({ value: search.trim(), delay: 300 })
  const { data, isFetching, isLoading, isError, error, refetch } = useQuery(
    queries.overrides.pricingList({
      offset,
      limit,
      search: debouncedSearch || undefined,
      scope: scope === 'all' ? undefined : scope,
    })
  )

  // The dialog's provider picker needs the full catalog tiles; the table
  // itself runs off the overrides list alone.
  const providersQuery = useQuery(queries.providers.list())
  const overview = providersQuery.data?.data
  const providers = [...(overview?.connected ?? []), ...(overview?.available ?? [])]

  const total = getTotal(data)
  const columns = PricingColumn({ loading: isFetching || isLoading, onEdit: setEditing })
  const filtered = debouncedSearch !== '' || scope !== 'all'

  const closeDialog = () => {
    setCreateOpen(false)
    setEditing(null)
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={IconCurrencyDollar}
        iconClassName="border-transparent bg-primary/10 text-primary"
        title="Model Pricing"
        description="Per-model token rates the gateway charges with. Overrides beat the built-in catalog; a provider-wide override prices every model without a specific row."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <IconPlus />
            Add Override
          </Button>
        }
      />

      <DashboardPanel
        icon={IconCurrencyDollar}
        title={
          <>
            Overrides
            <span className="font-normal text-muted-foreground tabular-nums">{total}</span>
          </>
        }
        toolbar={
          <FilterPricing
            search={search}
            onSearchChange={(value) => {
              setSearch(value)
              resetPage()
            }}
            scope={scope}
            onScopeChange={(value) => {
              setScope(value)
              resetPage()
            }}
          />
        }
      >
        {isError ? (
          <EmptyState
            icon={IconCurrencyDollar}
            title="Couldn't load pricing overrides"
            description={axiosErrorMessage(error)}
            action={
              <Button variant="outline" onClick={() => void refetch()}>
                Try again
              </Button>
            }
            className="py-10"
          />
        ) : (
          <ReactTable
            total={total}
            data={data?.data ?? []}
            pageIndex={pageIndex}
            pageSize={limit}
            columns={columns}
            emptyMessage={
              <EmptyState
                icon={IconCurrencyDollar}
                title={filtered ? 'No overrides match' : 'No pricing overrides'}
                description={
                  filtered
                    ? 'Try a different search or scope.'
                    : 'Models use the built-in catalog price until you add an override.'
                }
                className="py-10"
              />
            }
          />
        )}
      </DashboardPanel>

      <div className="px-0.5 text-xs text-muted-foreground">
        <p className="text-[12.5px] font-medium text-foreground">Resolution order</p>
        <p className="mt-1">
          Per-model override → provider-wide override → built-in static catalog → zero (free). A 0 /
          0 override marks a model &ldquo;free&rdquo; on purpose, and edits apply on the next
          request — no restart.
        </p>
      </div>

      <OverrideDialog
        key={editing?.id ?? 'create'}
        open={createOpen || Boolean(editing)}
        onClose={closeDialog}
        override={editing}
        providers={providers}
      />
    </div>
  )
}
