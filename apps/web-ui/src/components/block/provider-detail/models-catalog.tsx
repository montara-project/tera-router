import {
  IconApps,
  IconCircleCheck,
  IconDownload,
  IconEyeOff,
  IconRefresh,
  IconSearch,
} from '@tabler/icons-react'
import { useMemo } from 'react'
import { toast } from 'sonner'

import type { Models } from '@/lib/api/models'

import ModelCard from '@/components/block/provider-detail/model-card'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardHeading,
  CardTitle,
  CardToolbar,
} from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { EMERALD_BUTTON_CLASS } from '@/lib/constants/ui'

import EmptyState from '../common/empty-state'

export const CATALOG_PAGE_SIZE = 15

export default function ModelsCatalog({
  providerSlug,
  catalog,
  loading,
  searchValue,
  onSearchChange,
  pageIndex,
  onPageChange,
  selected,
  onSelectedChange,
  syncing,
  onSync,
  onUpdate,
}: {
  providerSlug: string
  catalog: Models.UpstreamModels | null
  loading: boolean
  searchValue: string
  onSearchChange: (value: string) => void
  pageIndex: number
  onPageChange: (page: number) => void
  selected: string[]
  onSelectedChange: (ids: string[]) => void
  syncing: boolean
  onSync: () => void
  onUpdate: (body: {
    models: { id: string; state: Models.ProviderModelState }[]
  }) => Promise<unknown>
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

  return (
    <Card className="bg-background">
      <CardHeader className="h-20">
        <CardHeading>
          <CardTitle>Model catalog</CardTitle>
          <CardDescription>
            {catalog
              ? `${enabledCount} of ${totalCount} models enabled in this catalog. Disabled models are excluded from routing.`
              : 'Sync from /models to import the provider model list into the catalog.'}
          </CardDescription>
        </CardHeading>
        <CardToolbar>
          <Button size="sm" className={EMERALD_BUTTON_CLASS} disabled={syncing} onClick={onSync}>
            {syncing ? <IconRefresh className="animate-spin" /> : <IconDownload />} Sync from
            /models
          </Button>
        </CardToolbar>
      </CardHeader>
      {loading ? (
        <CardContent className="p-5">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-36 rounded-xl" />
            ))}
          </div>
        </CardContent>
      ) : totalCount === 0 ? (
        <CardContent className="p-0">
          <EmptyState
            className="border-0"
            icon={IconApps}
            title="No catalog yet"
            description="Sync from /models to import every model this provider exposes, then enable the ones that should route. Enabled models become callable by their bare name."
            action={
              <Button
                size="sm"
                className={EMERALD_BUTTON_CLASS}
                disabled={syncing}
                onClick={onSync}
              >
                {syncing ? <IconRefresh className="animate-spin" /> : <IconDownload />} Sync now
              </Button>
            }
          />
        </CardContent>
      ) : (
        <CardContent className="p-0">
          <div className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-3">
            <div className="relative min-w-56 flex-1 md:max-w-sm">
              <IconSearch className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchValue}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search by model name or ID..."
                className="h-9 pl-9"
              />
            </div>
            {selectedInPage.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2">
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
              <div className="ml-auto flex items-center gap-3">
                <span className="text-xs text-muted-foreground">{filteredTotal} shown</span>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Checkbox
                    size="sm"
                    checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                    onCheckedChange={(checked) =>
                      onSelectedChange(checked === true ? models.map((m) => m.id) : [])
                    }
                    aria-label="Select all models on this page"
                  />
                  Select all
                </div>
              </div>
            )}
          </div>
          {filteredTotal === 0 ? (
            <EmptyState
              className="border-0"
              icon={IconSearch}
              title={`No models match "${searchValue}"`}
              description="Try a shorter name or clear the search to see the full catalog."
              action={
                <Button size="sm" variant="outline" onClick={() => onSearchChange('')}>
                  Clear search
                </Button>
              }
            />
          ) : models.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-muted-foreground">
              No models on this page — go back a page.
            </p>
          ) : (
            <div className="grid gap-3 p-5 md:grid-cols-2 xl:grid-cols-3">
              {models.map((model) => (
                <ModelCard
                  key={model.id}
                  providerSlug={providerSlug}
                  model={model}
                  selected={selected.includes(model.id)}
                  onToggleSelect={toggleSelect}
                  onToggleState={toggleModel}
                />
              ))}
            </div>
          )}
          {filteredTotal > CATALOG_PAGE_SIZE ? (
            <div className="flex items-center justify-between border-t border-border px-5 py-3">
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
        </CardContent>
      )}
    </Card>
  )
}
