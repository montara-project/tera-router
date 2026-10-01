import { IconArrowLeft, IconPlus, IconSettings, IconTrash } from '@tabler/icons-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate, useParams } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import SectionCard from '@/components/block/common/section-card'
import SimpleAlertDialog from '@/components/block/common/simple-alert-dialog'
import AccountsPanel from '@/components/block/provider-detail/accounts-panel'
import DetailSkeleton from '@/components/block/provider-detail/detail-skeleton'
import ModelsPanel from '@/components/block/provider-detail/models-panel'
import RoutingPanel from '@/components/block/provider-detail/routing-panel'
import SummaryTile from '@/components/block/provider-detail/summary-tile'
import { API_KEY_PROVIDERS, OAUTH_PROVIDERS } from '@/components/block/providers/catalog-connect'
import { AddCustomProviderApiKeyForm } from '@/components/block/providers/form-provider-api-key'
import { ProviderAvatar } from '@/components/block/providers/provider-avatar'
import { Badge, BadgeDot } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toastAxiosError } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'
import { ACCOUNT_QUERY_KEY } from '@/lib/api/queries/account'
import { CHAIN_QUERY_KEY } from '@/lib/api/queries/chain'
import {
  CUSTOM_PROVIDER_QUERY_KEY,
  GET_CUSTOM_PROVIDER_QUERY_KEY,
  PROVIDER_QUERY_KEY,
} from '@/lib/api/queries/provider'
import { USAGE_QUERY_KEY } from '@/lib/api/queries/usage'

export const Route = createFileRoute('/(protected)/(connection)/providers/$providerId')({
  component: CustomProviderDetailRoute,
})

const AMBER_BUTTON_CLASS =
  'bg-amber-600 text-white hover:bg-amber-500/90 dark:bg-amber-600 dark:hover:bg-amber-500/90'

function CustomProviderDetailRoute() {
  const { providerId } = useParams({ from: '/(protected)/(connection)/providers/$providerId' })
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState('overview')
  const [accountOpen, setAccountOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  // Catalog providers (openrouter, ollama, cline, …) carry a "prov-<slug>" id
  // and load their identity from the providers overview; custom providers
  // come from the custom-provider table by uuid.
  const isCatalogProvider = providerId.startsWith('prov-')
  const catalogSlug = isCatalogProvider ? providerId.slice('prov-'.length) : ''

  const providerQuery = useQuery({
    ...queries.providers.customGet(providerId),
    enabled: !isCatalogProvider,
  })
  const overviewQuery = useQuery(queries.providers.list())
  const catalogView = useMemo(() => {
    if (!isCatalogProvider) return null
    const overview = overviewQuery.data?.data
    return (
      [...(overview?.connected ?? []), ...(overview?.available ?? [])].find(
        (item) => item.id === providerId
      ) ?? null
    )
  }, [overviewQuery.data, isCatalogProvider, providerId])

  const provider = isCatalogProvider ? null : providerQuery.data
  const providerName = isCatalogProvider ? catalogView?.name : provider?.name
  const slug = isCatalogProvider ? catalogSlug : provider?.slug
  const apiKind = isCatalogProvider ? catalogView?.api_kind : provider?.api_kind
  const dialectLabel = apiKind === 'anthropic' ? 'Anthropic-compatible' : 'OpenAI-compatible'
  const isOAuthProvider = isCatalogProvider && OAUTH_PROVIDERS[catalogSlug] !== undefined
  const catalogAuthKind = isCatalogProvider ? API_KEY_PROVIDERS[catalogSlug]?.authKind : undefined

  const accountQuery = useQuery(queries.accounts.list({ offset: 0, limit: 100 }))
  const chainsQuery = useQuery(queries.chains.list({ offset: 0, limit: 100 }))
  const usageQuery = useQuery(queries.usage.telemetry('30d'))

  const deleteProviderMutation = useMutation(queries.providers.customDelete())
  const toggleProviderMutation = useMutation(queries.providers.customUpdate(providerId))
  const syncModelsMutation = useMutation(queries.providers.customModelsSync(providerId))
  const updateModelsMutation = useMutation(queries.providers.customModelsUpdate(providerId))
  const catalogSyncMutation = useMutation(queries.providers.catalogModelsSync(catalogSlug))
  const catalogUpdateMutation = useMutation(queries.providers.catalogModelsUpdate(catalogSlug))

  const accounts = useMemo(
    () => (accountQuery.data?.data ?? []).filter((account) => account.provider === slug),
    [accountQuery.data, slug]
  )
  const models = useMemo(() => {
    const rows = usageQuery.data?.modelAccounting ?? []
    return rows.filter((row) => row.provider.toLowerCase() === slug?.toLowerCase())
  }, [usageQuery.data, slug])
  const chains = useMemo(
    () =>
      (chainsQuery.data?.data ?? []).filter(
        (chain) =>
          chain.steps.some((step) => step.provider === slug) || chain.fallback_provider === slug
      ),
    [chainsQuery.data, slug]
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
      onSuccess: async (result) => {
        // The detail query for the deleted id refetches into a "not found"
        // retry loop (default retry backoff) — drop it before invalidating so
        // it can't delay navigation or flash the error card.
        queryClient.removeQueries({ queryKey: GET_CUSTOM_PROVIDER_QUERY_KEY(providerId) })
        toast.success(result.message || 'Provider deleted')
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

  const syncCatalog = async () => {
    try {
      const result = isCatalogProvider
        ? await catalogSyncMutation.mutateAsync()
        : await syncModelsMutation.mutateAsync()
      const priced = result.data.priced
      toast.success(
        `Synced ${result.data.models.length} models from upstream` +
          (priced ? ` · ${priced} priced` : '')
      )
    } catch (error) {
      toastAxiosError(error)
    }
  }

  if (isCatalogProvider ? overviewQuery.isLoading : providerQuery.isLoading) {
    return <DetailSkeleton />
  }

  if (isCatalogProvider ? !catalogView : providerQuery.isError || !provider) {
    return (
      <SectionCard title="Provider not found" description="This provider may have been removed.">
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

  return (
    <div className="space-y-4">
      <SectionCard
        title={providerName ?? ''}
        description={`${slug} · ${dialectLabel}`}
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
            <ProviderAvatar slug={slug ?? ''} apiKind={apiKind} size="lg" />
            <div className="flex flex-wrap items-center gap-2">
              {isCatalogProvider ? (
                <Badge variant="outline" size="sm">
                  Catalog
                </Badge>
              ) : (
                <>
                  <Badge
                    variant={provider?.enabled ? 'success' : 'secondary'}
                    appearance="light"
                    size="sm"
                  >
                    <BadgeDot />
                    {provider?.enabled ? 'Enabled' : 'Disabled'}
                  </Badge>
                  <Badge variant="outline" size="sm">
                    Custom
                  </Badge>
                </>
              )}
              <span className="text-xs text-muted-foreground">
                {accountCount} {accountCount === 1 ? 'account' : 'accounts'} · {models.length}{' '}
                observed models
              </span>
            </div>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              {!isOAuthProvider ? (
                <Button className={AMBER_BUTTON_CLASS} onClick={() => setAccountOpen(true)}>
                  <IconPlus /> Add API key
                </Button>
              ) : null}
              {!isCatalogProvider && provider ? (
                <>
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
                </>
              ) : null}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {isCatalogProvider ? (
              <>
                <SummaryTile label="Dialect" value={dialectLabel} />
                <SummaryTile
                  label="Auth"
                  value={
                    isOAuthProvider ? 'OAuth' : catalogAuthKind === 'none' ? 'None' : 'API key'
                  }
                />
                <SummaryTile
                  label="Accounts"
                  value={`${activeAccounts} active · ${accounts.length - activeAccounts} disabled`}
                />
              </>
            ) : (
              <>
                <SummaryTile label="Base URL" value={provider?.base_url ?? ''} mono />
                <SummaryTile label="Dialect" value={dialectLabel} />
                <SummaryTile
                  label="Accounts"
                  value={`${activeAccounts} active · ${accounts.length - activeAccounts} disabled`}
                />
              </>
            )}
          </div>

          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="w-full justify-start overflow-x-auto">
              <TabsTrigger value="overview">Accounts ({accounts.length})</TabsTrigger>
              <TabsTrigger value="routing">Routing ({chains.length})</TabsTrigger>
              <TabsTrigger value="models">Models ({models.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-4 space-y-4">
              <AccountsPanel
                accounts={accounts}
                loading={accountQuery.isLoading}
                canManageKeys={!isOAuthProvider}
                onAddKey={() => setAccountOpen(true)}
                onChanged={invalidate}
              />
            </TabsContent>

            <TabsContent value="models" className="mt-4">
              <ModelsPanel
                variant={isCatalogProvider ? 'catalog' : 'custom'}
                providerId={providerId}
                providerSlug={slug ?? ''}
                observed={models}
                observedLoading={usageQuery.isLoading}
                syncing={
                  isCatalogProvider ? catalogSyncMutation.isPending : syncModelsMutation.isPending
                }
                onSync={syncCatalog}
                onUpdate={
                  isCatalogProvider
                    ? catalogUpdateMutation.mutateAsync
                    : updateModelsMutation.mutateAsync
                }
              />
            </TabsContent>

            <TabsContent value="routing" className="mt-4">
              <RoutingPanel chains={chains} loading={chainsQuery.isLoading} slug={slug ?? ''} />
            </TabsContent>
          </Tabs>
        </div>
      </SectionCard>

      <AddCustomProviderApiKeyForm
        open={accountOpen}
        onOpenChange={setAccountOpen}
        provider={{ slug: slug ?? '', name: providerName ?? '' }}
        authKind={catalogAuthKind}
      />

      {!isCatalogProvider ? (
        <SimpleAlertDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          title="Delete custom provider?"
          description={`Delete ${providerName}? This permanently removes the provider, its ${accountCount} ${accountCount === 1 ? 'API key' : 'API keys'}, stored model catalog, and pricing overrides. Usage history is kept.`}
          confirmText="Delete provider"
          onConfirm={handleDeleteProvider}
          variant="destructive"
        />
      ) : null}
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
