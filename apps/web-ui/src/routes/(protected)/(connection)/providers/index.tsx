import { IconPackages, IconPlugConnected, IconPlus, IconTrash } from '@tabler/icons-react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useQueryState } from 'nuqs'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import type { Models } from '@/lib/api/models'

import EmptyState from '@/components/block/common/empty-state'
import PageHeader from '@/components/block/common/page-header'
import ReactTable from '@/components/block/common/react-table'
import SectionCardPanel from '@/components/block/common/section-card-panel'
import SimpleAlertDialog from '@/components/block/common/simple-alert-dialog'
import {
  API_KEY_PROVIDERS,
  CUSTOM_CONNECT_PRESETS,
  KEY_ONLY_PROVIDERS,
  OAUTH_FLOW_FOR,
  OAUTH_ONLY_PROVIDERS,
} from '@/components/block/providers/catalog-connect'
import { ProvidersColumn } from '@/components/block/providers/column'
import ConnectModeDialog from '@/components/block/providers/connect-mode-dialog'
import ConnectProviderDialog from '@/components/block/providers/connect-provider-dialog'
import FilterProviders from '@/components/block/providers/filter'
import { AddCustomProviderForm } from '@/components/block/providers/form'
import { AddCustomProviderApiKeyForm } from '@/components/block/providers/form-provider-api-key'
import OAuthPasteCodeDialog from '@/components/block/providers/oauth-paste-code-dialog'
import OAuthPollDialog from '@/components/block/providers/oauth-poll-dialog'
import { useOAuthConnect } from '@/components/block/providers/use-oauth-connect'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useDebounce } from '@/hooks/use-debounce'
import { usePaginationQuery } from '@/hooks/use-pagination-query'
import { toastAxiosError } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'
import { ACCOUNT_QUERY_KEY } from '@/lib/api/queries/account'
import { PROVIDER_QUERY_KEY, providerQueries } from '@/lib/api/queries/provider'
import { services } from '@/lib/api/services'

export const Route = createFileRoute('/(protected)/(connection)/providers/')({
  component: RouteComponent,
})

/** "A, B, C and 2 more" for the confirmation text. */
const listNames = (names: string[]) =>
  names.length <= 5
    ? names.join(', ')
    : `${names.slice(0, 5).join(', ')} and ${names.length - 5} more`

function RouteSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-12 w-72 rounded-lg" />
      <Skeleton className="h-96 w-full rounded-lg" />
    </div>
  )
}

function RouteComponent() {
  const [connectOpen, setConnectOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [createPreset, setCreatePreset] = useState<{ slug: string; api_kind: string } | undefined>(
    undefined
  )
  const [keyProvider, setKeyProvider] = useState<{ slug: string; name: string } | null>(null)
  const [modeProvider, setModeProvider] = useState<{ slug: string; name: string } | null>(null)
  // Providers awaiting delete confirmation; null while the dialog is closed.
  const [pendingDelete, setPendingDelete] = useState<Models.Provider[] | null>(null)
  const bulkDelete = useMutation(providerQueries.customBulkDelete())
  const {
    connect: connectOAuth,
    connecting,
    pasteFlow,
    pastePending,
    submitPasteCode,
    cancelPaste,
    pollFlow,
    cancelPoll,
  } = useOAuthConnect()
  const queryClient = useQueryClient()

  // The server searches, filters by capability and pages the connected
  // providers; the pager keeps its page in ?page.
  const { offset, limit, pageIndex } = usePaginationQuery()
  const [, setPageParam] = useQueryState('page')
  const [search, setSearch] = useState('')
  const [capability, setCapability] = useState('all')
  const q = useDebounce({ value: search.trim(), delay: 300 })
  const { data } = useQuery({
    ...providerQueries.list({
      search: q || undefined,
      capability: capability === 'all' ? undefined : (capability as Models.ProviderCapability),
      offset,
      limit,
    }),
    placeholderData: keepPreviousData,
  })
  const overview = data?.data

  const healthQuery = useQuery(queries.providerHealth.overview('24h'))
  const health = useMemo(
    () => new Map((healthQuery.data?.providers ?? []).map((h) => [h.id, h])),
    [healthQuery.data]
  )

  const columns = ProvidersColumn({ health })
  const [loadingEmpty, setLoadingEmpty] = useState(false)

  // The custom providers with no account are read when they are about to be
  // deleted; until then the overview only carries how many there are.
  const askDeleteEmpty = async () => {
    setLoadingEmpty(true)
    try {
      const res = await services.providers.list({ empty: true })
      setPendingDelete(res.data.data.connected)
    } catch (error) {
      toastAxiosError(error)
    } finally {
      setLoadingEmpty(false)
    }
  }

  if (!overview) {
    return <RouteSkeleton />
  }

  const confirmDelete = () => {
    const targets = pendingDelete ?? []
    setPendingDelete(null)
    if (targets.length === 0) return
    bulkDelete.mutate(
      targets.map((provider) => provider.id),
      {
        onSuccess: (res) => {
          toast.success(res.message ?? 'Providers deleted')
        },
        onError: toastAxiosError,
      }
    )
  }

  const handleNewProvider = () => {
    setCreatePreset(undefined)
    setCreateOpen(true)
  }

  const handleConnect = (provider: Models.Provider) => {
    const preset = CUSTOM_CONNECT_PRESETS[provider.slug]
    if (preset) {
      setCreatePreset(preset)
      setCreateOpen(true)
      return
    }
    // ZCode has no API key to paste: Connect starts its device sign-in
    // directly instead of offering the auth-mode choice first.
    if (OAUTH_ONLY_PROVIDERS[provider.slug]) {
      void connectOAuth(OAUTH_FLOW_FOR[provider.slug], provider.name)
      return
    }
    // OpenAI and Anthropic support both paths: official-website sign-in or a
    // pasted API key — offer the choice before opening either form.
    if (OAUTH_FLOW_FOR[provider.slug]) {
      setModeProvider({ slug: provider.slug, name: provider.name })
      return
    }
    if (API_KEY_PROVIDERS[provider.slug] || KEY_ONLY_PROVIDERS[provider.slug]) {
      setKeyProvider({ slug: provider.slug, name: provider.name })
      return
    }
    toast.info(`Connect flow for ${provider.name} is not wired to the backend yet`)
  }

  const handleModeOAuth = () => {
    const provider = modeProvider
    setModeProvider(null)
    if (provider) void connectOAuth(OAUTH_FLOW_FOR[provider.slug], provider.name)
  }

  const handleModeApiKey = () => {
    const provider = modeProvider
    setModeProvider(null)
    if (provider) setKeyProvider(provider)
  }

  const handleKeyConnected = async () => {
    const slug = keyProvider?.slug
    setKeyProvider(null)
    if (!slug) return
    // Connect and model sync in one step where the provider supports it
    // (OpenRouter also imports its per-model pricing).
    await queryClient.invalidateQueries({ queryKey: [PROVIDER_QUERY_KEY] })
    await queryClient.invalidateQueries({ queryKey: [ACCOUNT_QUERY_KEY] })
    if (API_KEY_PROVIDERS[slug]) {
      await syncModels(slug)
    }
  }
  const syncModels = async (slug: string) => {
    try {
      const result = await services.providers.modelsSync(slug)
      const payload = result.data.data
      toast.success(
        `Synced ${payload.models.length} models from upstream` +
          (payload.priced ? ` · ${payload.priced} priced` : '')
      )
    } catch (error) {
      toastAxiosError(error)
    }
  }

  return (
    <>
      <div className="flex flex-col gap-6">
        <PageHeader
          icon={IconPackages}
          title="Providers"
          description={`${overview.connected_count} connected · ${overview.available_count} available`}
          actions={
            <Button onClick={() => setConnectOpen(true)}>
              <IconPlus />
              <span>Connect provider</span>
            </Button>
          }
        />

        <SectionCardPanel
          icon={IconPlugConnected}
          title={
            <>
              Connected
              <span className="font-normal text-muted-foreground tabular-nums">
                {overview.connected_count}
              </span>
            </>
          }
          toolbar={
            <div className="flex flex-wrap items-center gap-2">
              {overview.empty_count > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={bulkDelete.isPending || loadingEmpty}
                  onClick={() => void askDeleteEmpty()}
                >
                  <IconTrash />
                  Delete empty ({overview.empty_count})
                </Button>
              )}
              <FilterProviders
                search={search}
                onSearchChange={(value) => {
                  setSearch(value)
                  void setPageParam(null)
                }}
                capability={capability}
                onCapabilityChange={(value) => {
                  setCapability(value)
                  void setPageParam(null)
                }}
              />
            </div>
          }
        >
          <ReactTable
            total={overview.connected_total}
            data={overview.connected}
            pageIndex={pageIndex}
            pageSize={limit}
            columns={columns}
            emptyMessage={
              <EmptyState
                icon={IconPlugConnected}
                title={
                  overview.connected_count === 0
                    ? 'No providers connected yet'
                    : 'No providers match'
                }
                description={
                  overview.connected_count === 0
                    ? 'Connect a provider to start routing requests through it.'
                    : 'Try a different search or capability.'
                }
                className="py-10"
              />
            }
          />
        </SectionCardPanel>
      </div>

      <ConnectProviderDialog
        open={connectOpen}
        onOpenChange={setConnectOpen}
        onConnect={handleConnect}
        onNewCustom={handleNewProvider}
      />

      <AddCustomProviderForm open={createOpen} onOpenChange={setCreateOpen} preset={createPreset} />

      <SimpleAlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null)
        }}
        title={`Delete ${pendingDelete?.length ?? 0} ${pendingDelete?.length === 1 ? 'provider' : 'providers'} without API keys?`}
        description={`${listNames((pendingDelete ?? []).map((provider) => provider.name))} will be removed with their stored model catalogs and pricing overrides. They have no API keys, so no credentials are deleted; a provider that gets one in the meantime is skipped. Usage history is kept.`}
        confirmText="Delete providers"
        onConfirm={confirmDelete}
        variant="destructive"
      />

      <AddCustomProviderApiKeyForm
        open={Boolean(keyProvider)}
        onOpenChange={(open) => {
          if (!open) {
            setKeyProvider(null)
          }
        }}
        provider={keyProvider ?? { slug: '', name: '' }}
        onSuccess={handleKeyConnected}
      />

      <ConnectModeDialog
        provider={modeProvider}
        onClose={() => setModeProvider(null)}
        onApiKey={handleModeApiKey}
        onOAuth={handleModeOAuth}
        oauthPending={connecting !== null}
      />

      <OAuthPasteCodeDialog
        open={pasteFlow !== null}
        providerName={pasteFlow?.name ?? ''}
        mode={pasteFlow?.mode ?? 'code'}
        pending={pastePending}
        onCancel={cancelPaste}
        onSubmit={(code) => void submitPasteCode(code)}
      />

      <OAuthPollDialog flow={pollFlow} onCancel={cancelPoll} />
    </>
  )
}
