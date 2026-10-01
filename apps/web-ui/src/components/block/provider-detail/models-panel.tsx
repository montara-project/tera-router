import { useQuery } from '@tanstack/react-query'
import { useQueryState } from 'nuqs'
import { useState } from 'react'

import type { Models } from '@/lib/api/models'

import ModelsCatalog, { CATALOG_PAGE_SIZE } from '@/components/block/provider-detail/models-catalog'
import ObservedPanel from '@/components/block/provider-detail/observed-panel'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useDebounce } from '@/hooks/use-debounce'
import { usePaginationQuery } from '@/hooks/use-pagination-query'
import { queries } from '@/lib/api/queries'

export default function ModelsPanel({
  variant,
  providerId,
  providerSlug,
  observed,
  observedLoading,
  syncing,
  onSync,
  onUpdate,
}: {
  /** catalog providers are keyed by slug; customs by their uuid */
  variant: 'catalog' | 'custom'
  providerId: string
  providerSlug: string
  observed: Models.UsageModelAccountingRow[]
  observedLoading: boolean
  syncing: boolean
  onSync: () => void
  onUpdate: (body: {
    models: { id: string; state: Models.ProviderModelState }[]
  }) => Promise<unknown>
}) {
  const [subTab, setSubTab] = useState('catalog')
  // Catalog search and paging are server-side: the raw input is debounced
  // before it reaches the query param, and a new search resets the page.
  const [searchInput, setSearchInput] = useState('')
  const search = useDebounce({ value: searchInput, delay: 300 })
  const [selected, setSelected] = useState<string[]>([])

  const { offset, limit, pageIndex } = usePaginationQuery({ limit: CATALOG_PAGE_SIZE })
  const [, setQueryPage] = useQueryState('page')

  const onSearchChange = (value: string) => {
    setSearchInput(value)
    setQueryPage(null)
    setSelected([])
  }

  const catalogQuery = useQuery(
    variant === 'catalog'
      ? queries.providers.catalogModels(providerSlug, { search, offset, limit })
      : queries.providers.customModels(providerId, { search, offset, limit })
  )
  const catalog = catalogQuery.data?.data ?? null

  const changePage = (next: number) => {
    setQueryPage(String(next))
    setSelected([])
  }

  return (
    <Tabs value={subTab} onValueChange={setSubTab}>
      <TabsList className="w-full justify-start overflow-x-auto">
        <TabsTrigger value="catalog">Catalog ({catalog?.enabled ?? 0})</TabsTrigger>
        <TabsTrigger value="observed">Observed ({observed.length})</TabsTrigger>
      </TabsList>
      <TabsContent value="catalog" className="mt-4">
        <ModelsCatalog
          variant={variant}
          providerId={providerId}
          providerSlug={providerSlug}
          catalog={catalog}
          loading={catalogQuery.isLoading}
          searchValue={searchInput}
          onSearchChange={onSearchChange}
          pageIndex={pageIndex}
          onPageChange={changePage}
          selected={selected}
          onSelectedChange={setSelected}
          syncing={syncing}
          onSync={onSync}
          onUpdate={onUpdate}
        />
      </TabsContent>
      <TabsContent value="observed" className="mt-4">
        <ObservedPanel models={observed} loading={observedLoading} />
      </TabsContent>
    </Tabs>
  )
}
