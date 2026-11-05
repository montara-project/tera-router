import { IconDownload, IconRefresh } from '@tabler/icons-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useQueryState } from 'nuqs'
import { useState } from 'react'
import { toast } from 'sonner'

import type { Models } from '@/lib/api/models'

import SegmentedControl from '@/components/block/common/segmented-control'
import ModelsCatalog, {
  CATALOG_PAGE_SIZE,
  type ModelStateFilter,
} from '@/components/block/provider-detail/models-catalog'
import ObservedPanel from '@/components/block/provider-detail/observed-panel'
import { Button } from '@/components/ui/button'
import { useDebounce } from '@/hooks/use-debounce'
import { usePaginationQuery } from '@/hooks/use-pagination-query'
import { axiosErrorMessage } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'
import { services } from '@/lib/api/services'

/** Result of one model in a "Test all" run, keyed by model id. */
export type ModelTestStatus =
  | { state: 'pending' }
  | { state: 'success'; latencyMs: number }
  | { state: 'failed'; detail: string }

/** Test calls in flight at once — keeps a run under upstream rate limits. */
const TEST_ALL_CONCURRENCY = 4
/** Model list page size for a run — the server caps the catalog page at 100. */
const TEST_ALL_PAGE_LIMIT = 100
const TEST_ALL_PROMPT = 'Reply with exactly: OK'

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
  const [subTab, setSubTab] = useState<'catalog' | 'observed'>('catalog')
  const [stateFilter, setStateFilter] = useState<ModelStateFilter>('all')
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

  const onStateFilterChange = (value: ModelStateFilter) => {
    setStateFilter(value)
    setQueryPage(null)
    setSelected([])
  }

  const state = stateFilter === 'all' ? undefined : stateFilter
  const catalogQuery = useQuery(
    variant === 'catalog'
      ? queries.providers.catalogModels(providerSlug, { search, offset, limit, state })
      : queries.providers.customModels(providerId, { search, offset, limit, state })
  )
  const catalog = catalogQuery.data?.data ?? null

  const qc = useQueryClient()
  const [testResults, setTestResults] = useState<Record<string, ModelTestStatus>>({})
  const [testingAll, setTestingAll] = useState(false)

  const testModel = async (model: string): Promise<ModelTestStatus> => {
    const payload = { model, messages: [{ role: 'user' as const, content: TEST_ALL_PROMPT }] }
    try {
      const res =
        variant === 'catalog'
          ? await services.providers.modelsTest(providerSlug, payload)
          : await services.providers.customModelsTest(providerId, payload)
      const result = res.data.data
      return result.ok
        ? { state: 'success', latencyMs: result.latency_ms }
        : { state: 'failed', detail: result.detail || `HTTP ${result.status}` }
    } catch (error) {
      return { state: 'failed', detail: axiosErrorMessage(error as Error) }
    }
  }

  // Tests every enabled model across the whole catalog, not just this page:
  // disabled models are excluded from routing, so they are left out.
  const testAll = async () => {
    setTestingAll(true)
    try {
      const ids: string[] = []
      for (let offset = 0; ; offset += TEST_ALL_PAGE_LIMIT) {
        const params = { state: 'active' as const, offset, limit: TEST_ALL_PAGE_LIMIT }
        const page = await qc.fetchQuery(
          variant === 'catalog'
            ? queries.providers.catalogModels(providerSlug, params)
            : queries.providers.customModels(providerId, params)
        )
        // Keep the client filter as a guard for servers predating the state param.
        ids.push(...page.data.models.filter((m) => m.state === 'active').map((m) => m.id))
        if (offset + TEST_ALL_PAGE_LIMIT >= (page.data.total ?? 0)) break
      }
      if (ids.length === 0) {
        toast.info('No enabled models to test')
        return
      }

      setTestResults(Object.fromEntries(ids.map((id) => [id, { state: 'pending' as const }])))
      const queue = [...ids]
      let failed = 0
      const worker = async () => {
        while (queue.length > 0) {
          const id = queue.shift()!
          const result = await testModel(id)
          if (result.state === 'failed') failed++
          setTestResults((prev) => ({ ...prev, [id]: result }))
        }
      }
      await Promise.all(Array.from({ length: TEST_ALL_CONCURRENCY }, worker))

      const summary = `${ids.length - failed} of ${ids.length} models passed`
      if (failed > 0) {
        toast.error(summary)
      } else {
        toast.success(summary)
      }
    } catch (error) {
      toast.error(axiosErrorMessage(error as Error))
    } finally {
      setTestingAll(false)
    }
  }

  const changePage = (next: number) => {
    setQueryPage(String(next))
    setSelected([])
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SegmentedControl
          aria-label="Model view"
          value={subTab}
          onChange={setSubTab}
          options={[
            { value: 'catalog', label: 'Catalog', count: catalog?.count ?? 0 },
            { value: 'observed', label: 'Observed', count: observed.length },
          ]}
        />
        <Button variant="outline" disabled={syncing} onClick={onSync}>
          {syncing ? <IconRefresh className="animate-spin" /> : <IconDownload />}
          Sync from /models
        </Button>
      </div>
      {subTab === 'catalog' ? (
        <ModelsCatalog
          variant={variant}
          providerId={providerId}
          providerSlug={providerSlug}
          catalog={catalog}
          loading={catalogQuery.isLoading}
          searchValue={searchInput}
          onSearchChange={onSearchChange}
          stateFilter={stateFilter}
          onStateFilterChange={onStateFilterChange}
          pageIndex={pageIndex}
          onPageChange={changePage}
          selected={selected}
          onSelectedChange={setSelected}
          syncing={syncing}
          onSync={onSync}
          onUpdate={onUpdate}
          testResults={testResults}
          testingAll={testingAll}
          onTestAll={testAll}
        />
      ) : (
        <ObservedPanel models={observed} loading={observedLoading} />
      )}
    </div>
  )
}
