import {
  IconApps,
  IconCircleCheck,
  IconDownload,
  IconEyeOff,
  IconLoader2,
  IconPlayerPlay,
  IconRefresh,
  IconSearch,
} from '@tabler/icons-react'
import { useMemo } from 'react'
import { toast } from 'sonner'

import type { ModelTestStatus } from '@/components/block/provider-detail/models-panel'
import type { Models } from '@/lib/api/models'

import DashboardPanel from '@/components/block/dashboard/dashboard-panel'
import ModelRow from '@/components/block/provider-detail/model-row'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input, InputWrapper } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { cn, selectAllState } from '@/lib/utils'

import EmptyState from '../common/empty-state'

export const CATALOG_PAGE_SIZE = 25

export type ModelStateFilter = 'all' | Models.ProviderModelState

const STATE_FILTERS: { value: ModelStateFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Enabled' },
  { value: 'disabled', label: 'Disabled' },
]

export default function ModelsCatalog({
  variant,
  providerId,
  providerSlug,
  catalog,
  loading,
  searchValue,
  onSearchChange,
  stateFilter,
  onStateFilterChange,
  pageIndex,
  onPageChange,
  selected,
  onSelectedChange,
  syncing,
  onSync,
  onUpdate,
  testResults,
  testingAll,
  onTestAll,
}: {
  /** catalog providers are keyed by slug; customs by their uuid */
  variant: 'catalog' | 'custom'
  providerId: string
  providerSlug: string
  catalog: Models.UpstreamModels | null
  loading: boolean
  searchValue: string
  onSearchChange: (value: string) => void
  stateFilter: ModelStateFilter
  onStateFilterChange: (value: ModelStateFilter) => void
  pageIndex: number
  onPageChange: (page: number) => void
  selected: string[]
  onSelectedChange: (ids: string[]) => void
  syncing: boolean
  onSync: () => void
  onUpdate: (body: {
    models: { id: string; state: Models.ProviderModelState }[]
  }) => Promise<unknown>
  testResults: Record<string, ModelTestStatus>
  testingAll: boolean
  onTestAll: () => void
}) {
  const models = useMemo(() => catalog?.models ?? [], [catalog])
  const enabledCount = catalog?.enabled ?? 0
  const totalCount = catalog?.count ?? 0
  const filteredTotal = catalog?.total ?? 0
  const pages = Math.max(1, Math.ceil(filteredTotal / CATALOG_PAGE_SIZE))
  // Selection is page-scoped: the catalog is paged server-side, so "select
  // all" and bulk actions operate on the rows currently on screen.
  const selectedInPage = selected.filter((id) => models.some((m) => m.id === id))
  const allSelected = models.length > 0 && selectedInPage.length === models.length
  const someSelected = selectedInPage.length > 0 && !allSelected
  const testStatuses = Object.values(testResults)
  const testedCount = testStatuses.filter((r) => r.state !== 'pending').length
  const filtering = searchValue.trim() !== '' || stateFilter !== 'all'

  const toggleModel = async (id: string, state: Models.ProviderModelState) => {
    try {
      await onUpdate({ models: [{ id, state }] })
    } catch {
      toast.error('Failed to update model')
    }
  }

  const bulkToggle = async (state: Models.ProviderModelState) => {
    if (selectedInPage.length === 0) return
    const count = selectedInPage.length
    try {
      await onUpdate({ models: selectedInPage.map((id) => ({ id, state })) })
      toast.success(
        `${count} ${count === 1 ? 'model' : 'models'} ${state === 'active' ? 'enabled' : 'disabled'}`
      )
      onSelectedChange([])
    } catch {
      toast.error('Failed to update models')
    }
  }

  const toggleSelect = (id: string, checked: boolean) => {
    onSelectedChange(checked ? [...selected, id] : selected.filter((x) => x !== id))
  }

  const renderBody = () => {
    if (loading) {
      return (
        <div className="space-y-2 p-4">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
      )
    }

    if (totalCount === 0) {
      return (
        <EmptyState
          className="border-0"
          icon={IconApps}
          title="No catalog yet"
          description="Sync from /models to import every model this provider exposes, then enable the ones that should route. Enabled models become callable by their bare name."
          action={
            <Button size="sm" disabled={syncing} onClick={onSync}>
              {syncing ? <IconRefresh className="animate-spin" /> : <IconDownload />} Sync now
            </Button>
          }
        />
      )
    }

    if (filteredTotal === 0) {
      return (
        <EmptyState
          className="border-0"
          icon={IconSearch}
          title="No models match"
          description="Try a shorter name or another state filter."
          action={
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                onSearchChange('')
                onStateFilterChange('all')
              }}
            >
              Clear filters
            </Button>
          }
        />
      )
    }

    return (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[44rem] text-[13px]">
          <thead className="border-b border-border text-xs text-muted-foreground dark:bg-muted/40">
            <tr>
              <th className="w-12 px-4 py-2">
                <Checkbox
                  size="sm"
                  checked={selectAllState(allSelected, someSelected)}
                  onCheckedChange={(checked) =>
                    onSelectedChange(checked === true ? models.map((m) => m.id) : [])
                  }
                  aria-label="Select all models on this page"
                />
              </th>
              <th className="w-[38%] py-2 pe-4 text-left font-medium">Model</th>
              <th className="px-4 py-2 text-left font-medium">Kind</th>
              <th className="px-4 py-2 text-left font-medium">Route as</th>
              <th className="px-4 py-2 text-right font-medium">Enabled</th>
            </tr>
          </thead>
          <tbody>
            {models.map((model) => (
              <ModelRow
                key={model.id}
                providerSlug={providerSlug}
                providerId={providerId}
                variant={variant}
                model={model}
                selected={selected.includes(model.id)}
                onToggleSelect={toggleSelect}
                onToggleState={toggleModel}
                testResult={testResults[model.id]}
              />
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <DashboardPanel
      icon={IconApps}
      title={
        <>
          Catalog
          <span className="font-normal text-muted-foreground">
            {enabledCount} of {totalCount} enabled
          </span>
        </>
      }
      toolbar={
        <Button
          size="sm"
          variant="outline"
          disabled={testingAll || enabledCount === 0}
          onClick={onTestAll}
        >
          {testingAll ? <IconLoader2 className="animate-spin" /> : <IconPlayerPlay />}
          {testingAll ? `Testing ${testedCount}/${testStatuses.length}` : 'Test all enabled'}
        </Button>
      }
    >
      {totalCount > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5">
          <InputWrapper className="w-full sm:w-64">
            <IconSearch aria-hidden />
            <Input
              type="search"
              aria-label="Filter models"
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Filter models"
            />
          </InputWrapper>
          <div role="group" aria-label="Model state" className="flex gap-1.5">
            {STATE_FILTERS.map((f) => {
              const active = stateFilter === f.value
              return (
                <button
                  key={f.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onStateFilterChange(f.value)}
                  className={cn(
                    'h-8 rounded-md border px-2.5 text-[12.5px] font-medium',
                    active
                      ? 'border-primary/40 bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:text-foreground'
                  )}
                >
                  {f.label}
                </button>
              )
            })}
          </div>
          {selectedInPage.length > 0 ? (
            <div className="ms-auto flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => bulkToggle('active')}>
                <IconCircleCheck /> Enable ({selectedInPage.length})
              </Button>
              <Button size="sm" variant="outline" onClick={() => bulkToggle('disabled')}>
                <IconEyeOff /> Disable ({selectedInPage.length})
              </Button>
              <Button size="sm" variant="ghost" onClick={() => onSelectedChange([])}>
                Clear
              </Button>
            </div>
          ) : (
            <span className="ms-auto text-[12.5px] text-muted-foreground tabular-nums">
              {filtering ? `${filteredTotal} of ${totalCount} shown` : `${filteredTotal} shown`}
            </span>
          )}
        </div>
      )}

      {renderBody()}

      {filteredTotal > CATALOG_PAGE_SIZE ? (
        <div className="flex items-center justify-between border-t border-border px-4 py-2.5">
          <p className="text-xs text-muted-foreground">{filteredTotal} models</p>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={pageIndex === 0}
              onClick={() => onPageChange(Math.max(0, pageIndex - 1))}
            >
              Previous
            </Button>
            <span className="text-xs tabular-nums text-muted-foreground">
              {pageIndex + 1} / {pages}
            </span>
            <Button
              variant="ghost"
              size="sm"
              disabled={pageIndex >= pages - 1}
              onClick={() => onPageChange(Math.min(pages - 1, pageIndex + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </DashboardPanel>
  )
}
