import type { AxiosError } from 'axios'

import {
  IconApps,
  IconArrowLeft,
  IconCircleCheck,
  IconCopy,
  IconDownload,
  IconEye,
  IconEyeOff,
  IconGitBranch,
  IconKey,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconSettings,
  IconTrash,
} from '@tabler/icons-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate, useParams } from '@tanstack/react-router'
import { useQueryState } from 'nuqs'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import type { Models } from '@/lib/api/models'

import SectionCard from '@/components/block/common/section-card'
import SimpleAlertDialog from '@/components/block/common/simple-alert-dialog'
import { fmtLatency } from '@/components/block/cost-analytics/usage/format'
import { AddCustomProviderApiKeyForm } from '@/components/block/providers/form-provider-api-key'
import { Badge, BadgeDot } from '@/components/ui/badge'
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
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useDebounce } from '@/hooks/use-debounce'
import { usePaginationQuery } from '@/hooks/use-pagination-query'
import { queries } from '@/lib/api/queries'
import { ACCOUNT_QUERY_KEY } from '@/lib/api/queries/account'
import { CHAIN_QUERY_KEY } from '@/lib/api/queries/chain'
import {
  CUSTOM_PROVIDER_QUERY_KEY,
  GET_CUSTOM_PROVIDER_QUERY_KEY,
  PROVIDER_QUERY_KEY,
} from '@/lib/api/queries/provider'
import { USAGE_QUERY_KEY } from '@/lib/api/queries/usage'
import { services } from '@/lib/api/services'

export const Route = createFileRoute('/(protected)/(connection)/providers/$providerId')({
  component: CustomProviderDetailRoute,
})

const PAGE_SIZE = 5
const CATALOG_PAGE_SIZE = 15
const AMBER_BUTTON_CLASS =
  'bg-amber-600 text-white hover:bg-amber-500/90 dark:bg-amber-600 dark:hover:bg-amber-500/90'
const EMERALD_BUTTON_CLASS =
  'bg-emerald-600 text-white hover:bg-emerald-500/90 dark:bg-emerald-600 dark:hover:bg-emerald-500/90'

function DetailSkeleton() {
  return (
    <div className="bg-sidebar rounded-2xl border border-sidebar-accent p-2">
      <div className="space-y-4 rounded-lg border border-border bg-background p-4">
        <Skeleton className="h-20 w-full rounded-xl" />
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-36 rounded-xl" />
          <Skeleton className="h-36 rounded-xl" />
          <Skeleton className="h-36 rounded-xl" />
        </div>
        <Skeleton className="h-12 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    </div>
  )
}

function ProviderAvatar({ slug }: { slug: string }) {
  const letter = slug.charAt(0).toUpperCase() || 'P'
  return (
    <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-lg font-bold text-amber-600 ring-1 ring-amber-500/20">
      {letter}
    </span>
  )
}

function CustomProviderDetailRoute() {
  const { providerId } = useParams({ from: '/(protected)/(connection)/providers/$providerId' })
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState('overview')
  const [accountOpen, setAccountOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteAccountId, setDeleteAccountId] = useState<string | null>(null)
  const [accountPage, setAccountPage] = useState(1)
  const [testingId, setTestingId] = useState<string | null>(null)
  const [testingAll, setTestingAll] = useState(false)

  const providerQuery = useQuery(queries.providers.customGet(providerId))
  const provider = providerQuery.data
  const accountQuery = useQuery(queries.accounts.list({ offset: 0, limit: 100 }))
  const chainsQuery = useQuery(queries.chains.list({ offset: 0, limit: 100 }))
  const usageQuery = useQuery(queries.usage.telemetry('30d'))

  const deleteProviderMutation = useMutation(queries.providers.customDelete())
  const toggleProviderMutation = useMutation(queries.providers.customUpdate(providerId))
  const testAccountMutation = useMutation(queries.accounts.test())
  const deleteAccountMutation = useMutation(queries.accounts.delete())
  const syncModelsMutation = useMutation(queries.providers.customModelsSync(providerId))
  const updateModelsMutation = useMutation(queries.providers.customModelsUpdate(providerId))

  const accounts = useMemo(
    () => (accountQuery.data?.data ?? []).filter((account) => account.provider === provider?.slug),
    [accountQuery.data, provider?.slug]
  )
  const models = useMemo(() => {
    const rows = usageQuery.data?.modelAccounting ?? []
    return rows.filter((row) => row.provider.toLowerCase() === provider?.slug.toLowerCase())
  }, [usageQuery.data, provider?.slug])
  const chains = useMemo(
    () =>
      (chainsQuery.data?.data ?? []).filter(
        (chain) =>
          chain.steps.some((step) => step.provider === provider?.slug) ||
          chain.fallback_provider === provider?.slug
      ),
    [chainsQuery.data, provider?.slug]
  )

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: [PROVIDER_QUERY_KEY] }),
      queryClient.invalidateQueries({ queryKey: [CUSTOM_PROVIDER_QUERY_KEY] }),
      queryClient.invalidateQueries({ queryKey: [ACCOUNT_QUERY_KEY] }),
      queryClient.invalidateQueries({ queryKey: [CHAIN_QUERY_KEY] }),
      queryClient.invalidateQueries({ queryKey: [USAGE_QUERY_KEY] }),
    ])
  }

  const handleDeleteProvider = () => {
    deleteProviderMutation.mutate(providerId, {
      onSuccess: async () => {
        // The detail query for the deleted id refetches into a "not found"
        // retry loop (default retry backoff) — drop it before invalidating so
        // it can't delay navigation or flash the error card.
        queryClient.removeQueries({ queryKey: GET_CUSTOM_PROVIDER_QUERY_KEY(providerId) })
        toast.success('Provider deleted')
        setDeleteOpen(false)
        await navigate({ to: '/providers' })
        await invalidate()
      },
      onError: () => toast.error('Failed to delete provider'),
    })
  }

  const handleToggleProvider = (enabled: boolean) => {
    if (!provider) return
    toggleProviderMutation.mutate(
      {
        name: provider.name,
        slug: provider.slug,
        base_url: provider.base_url,
        api_kind: provider.api_kind,
        pricing: parseJSON(provider.pricing),
        metadata: parseJSON(provider.metadata),
        priority: provider.priority,
        enabled,
      },
      {
        onSuccess: async () => {
          await invalidate()
          toast.success(provider.enabled ? 'Provider disabled' : 'Provider enabled')
        },
        onError: () => toast.error('Failed to update provider'),
      }
    )
  }

  const testAccount = async (id: string) => {
    setTestingId(id)
    try {
      const result = await testAccountMutation.mutateAsync(id)
      toast[result.data.ok ? 'success' : 'error'](
        result.data.ok
          ? `Connection successful · ${result.data.latency_ms} ms`
          : result.data.detail || 'Connection test failed'
      )
    } catch {
      toast.error('Connection test failed')
    } finally {
      setTestingId(null)
    }
  }

  const removeAccount = async (id: string) => {
    try {
      await deleteAccountMutation.mutateAsync(id)
      await invalidate()
      toast.success('Account removed')
      setDeleteAccountId(null)
    } catch {
      toast.error('Failed to remove account')
    }
  }

  const testAll = async () => {
    if (accounts.length === 0) {
      toast.info('No accounts to test')
      return
    }
    setTestingAll(true)
    let ok = 0
    for (const account of accounts) {
      try {
        const result = await services.accounts.test(account.id)
        if (result.data.data.ok) ok += 1
      } catch {
        // counted as failure below
      }
    }
    setTestingAll(false)
    if (ok === accounts.length) toast.success(`All ${ok} accounts reachable`)
    else toast.warning(`${ok} of ${accounts.length} accounts reachable`)
  }

  const syncCatalog = async () => {
    try {
      const result = await syncModelsMutation.mutateAsync()
      const priced = result.data.priced
      toast.success(
        `Synced ${result.data.models.length} models from upstream` +
          (priced ? ` · ${priced} priced` : '')
      )
    } catch (err) {
      const detail = (err as AxiosError<{ message?: string }>).response?.data?.message
      toast.error(detail || 'Failed to sync models from upstream')
    }
  }

  if (providerQuery.isLoading) return <DetailSkeleton />

  if (providerQuery.isError || !provider) {
    return (
      <SectionCard
        title="Provider not found"
        description="This custom provider may have been removed."
      >
        <Button asChild variant="outline">
          <Link to="/providers">
            <IconArrowLeft />
            Back to providers
          </Link>
        </Button>
      </SectionCard>
    )
  }

  const accountCount = accounts.length
  const activeAccounts = accounts.filter(
    (account) => !account.disabled && account.status === 'active'
  ).length
  const providerModels = models
  const visibleAccounts = accounts.slice((accountPage - 1) * PAGE_SIZE, accountPage * PAGE_SIZE)
  const accountPages = Math.max(1, Math.ceil(accounts.length / PAGE_SIZE))

  return (
    <div className="space-y-4">
      <SectionCard
        title={provider.name}
        description={`${provider.slug} · ${provider.api_kind === 'anthropic' ? 'Anthropic-compatible' : 'OpenAI-compatible'}`}
        toolbar={
          <Button asChild variant="outline" size="sm">
            <Link to="/providers">
              <IconArrowLeft />
              Back
            </Link>
          </Button>
        }
      >
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-4">
            <ProviderAvatar slug={provider.slug} />
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant={provider.enabled ? 'success' : 'secondary'}
                appearance="light"
                size="sm"
              >
                <BadgeDot />
                {provider.enabled ? 'Enabled' : 'Disabled'}
              </Badge>
              <Badge variant="outline" size="sm">
                Custom
              </Badge>
              <span className="text-xs text-muted-foreground">
                {accountCount} {accountCount === 1 ? 'account' : 'accounts'} ·{' '}
                {providerModels.length} observed models
              </span>
            </div>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <Button className={AMBER_BUTTON_CLASS} onClick={() => setAccountOpen(true)}>
                <IconPlus /> Add API key
              </Button>
              <Button
                variant="outline"
                onClick={() => handleToggleProvider(!provider.enabled)}
                disabled={toggleProviderMutation.isPending}
              >
                <IconSettings />
                {provider.enabled ? 'Disable' : 'Enable'}
              </Button>
              <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
                <IconTrash /> Delete
              </Button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <SummaryTile label="Base URL" value={provider.base_url} mono />
            <SummaryTile
              label="Dialect"
              value={
                provider.api_kind === 'anthropic' ? 'Anthropic-compatible' : 'OpenAI-compatible'
              }
            />
            <SummaryTile
              label="Accounts"
              value={`${activeAccounts} active · ${accounts.length - activeAccounts} disabled`}
            />
          </div>

          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="w-full justify-start overflow-x-auto">
              <TabsTrigger value="overview">Accounts ({accounts.length})</TabsTrigger>
              <TabsTrigger value="routing">Routing ({chains.length})</TabsTrigger>
              <TabsTrigger value="models">Models ({providerModels.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-4 space-y-4">
              <Card className="bg-background">
                <CardHeader className="h-20">
                  <CardHeading>
                    <CardTitle>Account routing</CardTitle>
                    <CardDescription>
                      Credentials available to this provider and the order used for routing.
                    </CardDescription>
                  </CardHeading>
                  <CardToolbar>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" disabled={testingAll} onClick={testAll}>
                        {testingAll ? (
                          <IconRefresh className="animate-spin" />
                        ) : (
                          <IconCircleCheck />
                        )}{' '}
                        Test all
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setAccountOpen(true)}>
                        <IconPlus /> Import keys
                      </Button>
                    </div>
                  </CardToolbar>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="flex items-center justify-between border-b border-border px-5 py-2.5">
                    <p className="flex items-center gap-1.5 text-xs font-medium text-emerald-500">
                      <span className="size-1.5 rounded-full bg-emerald-500" />
                      {activeAccounts} active
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Priority determines first-choice routing.
                    </p>
                  </div>
                  {accountQuery.isLoading ? (
                    <div className="space-y-2 p-5">
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                  ) : accounts.length === 0 ? (
                    <Empty className="border-0 py-12">
                      <EmptyHeader>
                        <EmptyMedia variant="icon">
                          <IconKey />
                        </EmptyMedia>
                        <EmptyTitle>No API keys yet</EmptyTitle>
                        <EmptyDescription>
                          Add a credential to enable requests through this provider.
                        </EmptyDescription>
                      </EmptyHeader>
                    </Empty>
                  ) : (
                    <div className="overflow-x-auto">
                      <div className="min-w-[700px]">
                        <div className="flex items-center justify-between border-b border-border px-5 py-2.5">
                          <p className="text-xs text-muted-foreground">
                            {accounts.length} connected{' '}
                            {accounts.length === 1 ? 'account' : 'accounts'}
                          </p>
                          <label className="flex items-center gap-2 text-xs text-muted-foreground">
                            <input
                              type="checkbox"
                              className="accent-emerald-600"
                              onChange={() => undefined}
                            />
                            Select page
                          </label>
                        </div>
                        <div className="grid grid-cols-[1.5fr_1fr_0.8fr_1fr_1fr] gap-4 border-b border-border px-5 py-3 text-xs text-muted-foreground">
                          <span>Account</span>
                          <span>Auth</span>
                          <span>Priority</span>
                          <span>Connection</span>
                          <span className="text-right">Actions</span>
                        </div>
                        {visibleAccounts.map((account) => (
                          <div
                            key={account.id}
                            className="grid grid-cols-[1.5fr_1fr_0.8fr_1fr_1fr] items-center gap-4 border-b border-border/60 px-5 py-3 hover:bg-muted/30"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">
                                {account.label || 'API key'}
                              </p>
                              <p className="font-mono text-xs text-muted-foreground">
                                {account.key_fingerprint || 'Credential stored securely'}
                              </p>
                            </div>
                            <span className="text-sm">
                              {account.auth_kind === 'api_key' ? 'API key' : account.auth_kind}
                            </span>
                            <span className="font-mono text-sm">{account.priority}</span>
                            <Badge
                              variant={
                                account.disabled || account.status !== 'active'
                                  ? 'secondary'
                                  : 'success'
                              }
                              appearance="light"
                              size="sm"
                            >
                              <BadgeDot />
                              {account.disabled || account.status !== 'active'
                                ? 'Disabled'
                                : 'Direct connection'}
                            </Badge>
                            <div className="flex justify-end gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                aria-label={`Test ${account.label}`}
                                disabled={testingId === account.id}
                                onClick={() => testAccount(account.id)}
                              >
                                {testingId === account.id ? (
                                  <IconRefresh className="animate-spin" />
                                ) : (
                                  <IconCircleCheck />
                                )}
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                aria-label={`Delete ${account.label}`}
                                onClick={() => setDeleteAccountId(account.id)}
                              >
                                <IconTrash />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {accounts.length > PAGE_SIZE ? (
                    <div className="flex items-center justify-between border-t border-border px-5 py-3">
                      <p className="text-xs text-muted-foreground">{accounts.length} total</p>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={accountPage <= 1}
                          onClick={() => setAccountPage((p) => Math.max(1, p - 1))}
                        >
                          Previous
                        </Button>
                        <span className="text-xs tabular-nums text-muted-foreground">
                          {accountPage} / {accountPages}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={accountPage >= accountPages}
                          onClick={() => setAccountPage((p) => Math.min(accountPages, p + 1))}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="models" className="mt-4">
              <ModelsPanel
                providerId={providerId}
                providerSlug={provider.slug}
                observed={providerModels}
                observedLoading={usageQuery.isLoading}
                syncing={syncModelsMutation.isPending}
                onSync={syncCatalog}
                onUpdate={updateModelsMutation.mutateAsync}
              />
            </TabsContent>

            <TabsContent value="routing" className="mt-4">
              <RoutingPanel chains={chains} loading={chainsQuery.isLoading} slug={provider.slug} />
            </TabsContent>
          </Tabs>
        </div>
      </SectionCard>

      <AddCustomProviderApiKeyForm
        open={accountOpen}
        onOpenChange={setAccountOpen}
        provider={provider}
      />

      <SimpleAlertDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete custom provider?"
        description={`Delete ${provider.name}? This removes the provider configuration. Remove its accounts first if they are still in use.`}
        confirmText="Delete provider"
        onConfirm={handleDeleteProvider}
        variant="destructive"
      />
      <SimpleAlertDialog
        open={deleteAccountId !== null}
        onOpenChange={(open) => !open && setDeleteAccountId(null)}
        title="Delete API key?"
        description="This permanently removes the selected credential from this provider."
        confirmText="Delete API key"
        onConfirm={() => deleteAccountId && removeAccount(deleteAccountId)}
        variant="destructive"
      />
    </div>
  )
}

function SummaryTile({
  label,
  value,
  mono = false,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <Card className="bg-background">
      <CardContent className="p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className={`mt-2 break-all text-sm ${mono ? 'font-mono' : 'font-medium'}`}>
          {value || '—'}
        </p>
      </CardContent>
    </Card>
  )
}

function ModelsPanel({
  providerId,
  providerSlug,
  observed,
  observedLoading,
  syncing,
  onSync,
  onUpdate,
}: {
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
    queries.providers.customModels(providerId, { search, offset, limit })
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

function ModelsCatalog({
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
          <Empty className="border-0 py-12">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <IconApps />
              </EmptyMedia>
              <EmptyTitle>No catalog yet</EmptyTitle>
              <EmptyDescription>
                Sync from /models to import every model this provider exposes, then enable the ones
                that should route. Enabled models become callable by their bare name.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
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
            <Empty className="border-0 py-12">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <IconSearch />
                </EmptyMedia>
                <EmptyTitle>No models match "{searchValue}"</EmptyTitle>
                <EmptyDescription>
                  Try a shorter name or clear the search to see the full catalog.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
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

function ModelCard({
  providerSlug,
  model,
  selected,
  onToggleSelect,
  onToggleState,
}: {
  providerSlug: string
  model: Models.ProviderModel
  selected: boolean
  onToggleSelect: (id: string, checked: boolean) => void
  onToggleState: (id: string, state: Models.ProviderModelState) => void
}) {
  const active = model.state === 'active'
  const composite = `${providerSlug}/${model.id}`

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(model.id)
      toast.success('Model ID copied')
    } catch {
      toast.error('Failed to copy model ID')
    }
  }

  return (
    <div
      className={`rounded-xl border p-4 transition-colors ${active ? 'bg-background' : 'bg-muted/20'}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Checkbox
            size="sm"
            checked={selected}
            onCheckedChange={(checked) => onToggleSelect(model.id, checked === true)}
            aria-label={`Select ${model.id}`}
          />
          <Badge variant={active ? 'success' : 'secondary'} appearance="light" size="sm">
            <BadgeDot />
            {active ? 'Enabled' : 'Disabled'}
          </Badge>
        </div>
        <Badge variant="outline" size="sm">
          llm
        </Badge>
      </div>
      <p className="mt-3 truncate text-sm font-semibold" title={model.id}>
        {model.id}
      </p>
      <p
        className="mt-1.5 truncate rounded-md bg-muted/50 px-2 py-1 font-mono text-xs text-muted-foreground"
        title={composite}
      >
        {composite}
      </p>
      <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-2.5">
        <span className={`text-xs ${active ? 'text-emerald-500' : 'text-muted-foreground'}`}>
          {active ? 'Enabled in catalog' : 'Excluded from routing'}
        </span>
        <div className="flex gap-1">
          <Button
            size="icon"
            variant="ghost"
            aria-label={active ? `Disable ${model.id}` : `Enable ${model.id}`}
            onClick={() => onToggleState(model.id, active ? 'disabled' : 'active')}
          >
            {active ? <IconEye /> : <IconEyeOff />}
          </Button>
          <Button size="icon" variant="ghost" aria-label={`Copy ${model.id}`} onClick={copy}>
            <IconCopy />
          </Button>
        </div>
      </div>
    </div>
  )
}

function ObservedPanel({
  models,
  loading,
}: {
  models: Models.UsageModelAccountingRow[]
  loading: boolean
}) {
  if (loading)
    return (
      <div className="space-y-2">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    )
  if (!models.length) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <IconApps />
          </EmptyMedia>
          <EmptyTitle>No observed models yet</EmptyTitle>
          <EmptyDescription>
            Models appear here after this provider has terminal usage. The catalog tab lists every
            model the provider exposes.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }
  return (
    <Card className="bg-background">
      <CardHeader className="h-20">
        <CardHeading>
          <CardTitle>Observed models ({models.length})</CardTitle>
          <CardDescription>Models seen in terminal usage for this provider.</CardDescription>
        </CardHeading>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-border/60">
          {models.map((model) => (
            <div
              key={model.id}
              className="grid grid-cols-[1.4fr_0.8fr_0.9fr_1fr] items-center gap-4 px-5 py-3"
            >
              <div>
                <p className="font-mono text-sm font-medium">{model.model}</p>
                <p className="text-xs text-muted-foreground">{model.provider}</p>
              </div>
              <span className="text-sm tabular-nums">{model.requests} requests</span>
              <span className="text-sm tabular-nums">{model.successPct}% success</span>
              <span className="text-sm tabular-nums">{fmtLatency(model.latencyMs)} avg</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function RoutingPanel({
  chains,
  loading,
  slug,
}: {
  chains: Models.Chain[]
  loading: boolean
  slug: string
}) {
  if (loading)
    return (
      <div className="space-y-2">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    )
  if (!chains.length) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <IconGitBranch />
          </EmptyMedia>
          <EmptyTitle>No routing chains use this provider</EmptyTitle>
          <EmptyDescription>Chains that include {slug} will appear here.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }
  return (
    <div className="space-y-3">
      {chains.map((chain) => (
        <Card key={chain.id} className="bg-background">
          <CardContent className="flex flex-wrap items-center gap-4 p-4">
            <span className="flex size-9 items-center justify-center rounded-lg bg-emerald-950 text-emerald-400">
              <IconGitBranch />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-medium">{chain.name}</p>
              <p className="text-xs text-muted-foreground">
                {chain.steps.length} steps · {chain.strategy}
              </p>
            </div>
            <Badge variant={chain.enabled ? 'success' : 'secondary'} appearance="light">
              {chain.enabled ? 'Enabled' : 'Disabled'}
            </Badge>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function parseJSON(value: string): Record<string, unknown> {
  try {
    return JSON.parse(value) as Record<string, unknown>
  } catch {
    return {}
  }
}
