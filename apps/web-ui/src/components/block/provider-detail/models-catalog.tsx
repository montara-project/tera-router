import type { ColumnDef } from '@tanstack/react-table'

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

import ReactTable, { features } from '@/components/block/common/react-table'
import SectionCardPanel from '@/components/block/common/section-card-panel'
import {
  ModelActionsCell,
  RouteAsCell,
  TestBadge,
} from '@/components/block/provider-detail/model-row'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input, InputWrapper } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { cn, selectAllState } from '@/lib/utils'

import EmptyState from '../common/empty-state'

/** The pager never offers fewer than 10 rows; the server caps a page at 100. */
export const CATALOG_PAGE_SIZES = [10, 25, 50, 100]

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
  pageSize,
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
  pageSize: number
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
      <ReactTable
        total={filteredTotal}
        data={models}
        pageIndex={pageIndex}
        pageSize={pageSize}
        pageSizes={CATALOG_PAGE_SIZES}
        onPageChange={() => onSelectedChange([])}
        onPageSizeChange={() => onSelectedChange([])}
        columns={columns}
        tableClassName="min-w-[44rem]"
      />
    )
  }

  const columns: ColumnDef<typeof features, Models.ProviderModel, unknown>[] = [
    {
      id: 'select',
      header: () => (
        <Checkbox
          size="sm"
          checked={selectAllState(allSelected, someSelected)}
          onCheckedChange={(checked) =>
            onSelectedChange(checked === true ? models.map((m) => m.id) : [])
          }
          aria-label="Select all models on this page"
        />
      ),
      meta: { headerClassName: 'w-12' },
      cell: ({ row }) => (
        <Checkbox
          size="sm"
          checked={selected.includes(row.original.id)}
          onCheckedChange={(checked) => toggleSelect(row.original.id, checked === true)}
          aria-label={`Select ${row.original.id}`}
        />
      ),
    },
    {
      id: 'model',
      header: 'Model',
      meta: { headerClassName: 'w-[38%]', cellClassName: 'max-w-0' },
      cell: ({ row }) => (
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={cn(
              'truncate font-medium',
              row.original.state !== 'active' && 'text-muted-foreground'
            )}
            title={row.original.id}
          >
            {row.original.id}
          </span>
          <TestBadge result={testResults[row.original.id]} />
        </div>
      ),
    },
    {
      id: 'kind',
      header: 'Kind',
      meta: { cellClassName: 'text-muted-foreground' },
      cell: () => 'llm',
    },
    {
      id: 'route_as',
      header: 'Route as',
      meta: { cellClassName: 'max-w-0' },
      cell: ({ row }) => <RouteAsCell routeAs={`${providerSlug}/${row.original.id}`} />,
    },
    {
      id: 'enabled',
      header: 'Enabled',
      meta: { headerClassName: 'text-right' },
      cell: ({ row }) => (
        <ModelActionsCell
          providerSlug={providerSlug}
          providerId={providerId}
          variant={variant}
          model={row.original}
          onToggleState={toggleModel}
        />
      ),
    },
  ]

  return (
    <SectionCardPanel
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
    </SectionCardPanel>
  )
}
