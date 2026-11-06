import { IconPackages, IconPlugConnected, IconPlus, IconTrash } from '@tabler/icons-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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
} from '@/components/block/providers/catalog-connect'
import { ProvidersColumn } from '@/components/block/providers/column'
import ConnectModeDialog from '@/components/block/providers/connect-mode-dialog'
import ConnectProviderDialog from '@/components/block/providers/connect-provider-dialog'
import FilterProviders from '@/components/block/providers/filter'
import { AddCustomProviderForm } from '@/components/block/providers/form'
import { AddCustomProviderApiKeyForm } from '@/components/block/providers/form-provider-api-key'
import OAuthPasteCodeDialog from '@/components/block/providers/oauth-paste-code-dialog'
import { useOAuthConnect } from '@/components/block/providers/use-oauth-connect'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { usePaginationQuery } from '@/hooks/use-pagination-query'
import { toastAxiosError } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'
import { ACCOUNT_QUERY_KEY } from '@/lib/api/queries/account'
import { PROVIDER_QUERY_KEY, providerQueries } from '@/lib/api/queries/provider'
import { services } from '@/lib/api/services'

export const Route = createFileRoute('/(protected)/(connection)/providers/')({
  component: RouteComponent,
})

/**
 * A connected provider with no account (no API key or OAuth login) is just a
 * stored custom_providers row, safe to delete. Catalog-only entries carry a
 * "prov-<slug>" id and have nothing to delete.
 */
const isEmptyProvider = (provider: Models.Provider) =>
  (provider.accounts ?? 0) === 0 && !provider.id.startsWith('prov-')

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
  } = useOAuthConnect()
  const queryClient = useQueryClient()

  const { data } = useQuery(providerQueries.list())
  const overview = data?.data

  const healthQuery = useQuery(queries.providerHealth.overview('24h'))
  const health = useMemo(
    () => new Map((healthQuery.data?.providers ?? []).map((h) => [h.id, h])),
    [healthQuery.data]
  )

  const emptyProviders = (overview?.connected ?? []).filter(isEmptyProvider)
  const columns = ProvidersColumn({ health })

  // The list arrives whole, so search, capability and paging run here; the
  // pager keeps its page in ?page like the server-paged tables.
  const { offset, limit, pageIndex } = usePaginationQuery()
  const [, setPageParam] = useQueryState('page')
  const [search, setSearch] = useState('')
  const [capability, setCapability] = useState('all')
  const q = search.trim().toLowerCase()
  const rows = (overview?.connected ?? []).filter(
    (p) =>
      (capability === 'all' || p.capabilities.includes(capability as Models.ProviderCapability)) &&
      (!q || `${p.name} ${p.slug}`.toLowerCase().includes(q))
  )

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
          iconClassName="border-transparent bg-teal-500/10 text-teal-700 dark:text-teal-400"
          title="Providers"
          description={`${overview.connected.length} connected · ${overview.available.length} available`}
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
                {overview.connected.length}
              </span>
            </>
          }
          toolbar={
            <div className="flex flex-wrap items-center gap-2">
              {emptyProviders.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={bulkDelete.isPending}
                  onClick={() => setPendingDelete(emptyProviders)}
                >
                  <IconTrash />
                  Delete empty ({emptyProviders.length})
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
            total={rows.length}
            data={rows.slice(offset, offset + limit)}
            pageIndex={pageIndex}
            pageSize={limit}
            columns={columns}
            emptyMessage={
              <EmptyState
                icon={IconPlugConnected}
                title={
                  overview.connected.length === 0
                    ? 'No providers connected yet'
                    : 'No providers match'
                }
                description={
                  overview.connected.length === 0
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
        connected={overview.connected}
        available={overview.available}
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
    </>
  )
}
