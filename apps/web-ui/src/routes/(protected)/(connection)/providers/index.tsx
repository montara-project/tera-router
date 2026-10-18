import {
  IconApps,
  IconMessageCircle,
  IconMicrophone,
  IconPhoto,
  IconPlugConnected,
  IconPlus,
  IconSearch,
  IconTrash,
  IconWorld,
} from '@tabler/icons-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import type { Models } from '@/lib/api/models'

import IconBadge from '@/components/block/common/icon-badge'
import SectionCard from '@/components/block/common/section-card'
import SimpleAlertDialog from '@/components/block/common/simple-alert-dialog'
import {
  API_KEY_PROVIDERS,
  CUSTOM_CONNECT_PRESETS,
  KEY_ONLY_PROVIDERS,
  OAUTH_FLOW_FOR,
} from '@/components/block/providers/catalog-connect'
import ConnectModeDialog from '@/components/block/providers/connect-mode-dialog'
import { AddCustomProviderForm } from '@/components/block/providers/form'
import { AddCustomProviderApiKeyForm } from '@/components/block/providers/form-provider-api-key'
import OAuthPasteCodeDialog from '@/components/block/providers/oauth-paste-code-dialog'
import ProviderGrid from '@/components/block/providers/provider-grid'
import { useOAuthConnect } from '@/components/block/providers/use-oauth-connect'
import { Badge } from '@/components/ui/badge'
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
import { Input, InputWrapper } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toastAxiosError } from '@/lib/api/axios-error'
import { ACCOUNT_QUERY_KEY } from '@/lib/api/queries/account'
import { PROVIDER_QUERY_KEY, providerQueries } from '@/lib/api/queries/provider'
import { services } from '@/lib/api/services'

export const Route = createFileRoute('/(protected)/(connection)/providers/')({
  component: RouteComponent,
})

/**
 * Provider categories, one tab each. A provider belongs to every category
 * whose capabilities it lists, so OpenAI shows under Model, Voice and Image.
 */
const CATEGORIES = [
  {
    value: 'model',
    label: 'AI Model Providers',
    icon: IconMessageCircle,
    capabilities: ['chat', 'embeddings'],
  },
  {
    value: 'search',
    label: 'AI Search Providers',
    icon: IconWorld,
    capabilities: ['search', 'fetch'],
  },
  {
    value: 'voice',
    label: 'AI Voice Providers',
    icon: IconMicrophone,
    capabilities: ['tts', 'stt'],
  },
  { value: 'image', label: 'AI Image Generation', icon: IconPhoto, capabilities: ['image'] },
] as const satisfies {
  value: string
  label: string
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
  capabilities: Models.ProviderCapability[]
}[]

type Category = (typeof CATEGORIES)[number]

const inCategory = (provider: Models.Provider, category: Category) =>
  category.capabilities.some((capability) => provider.capabilities.includes(capability))

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
    <div className="bg-sidebar border border-sidebar-accent p-2 rounded-2xl">
      <div className="rounded-lg border border-border bg-background p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0 space-y-2">
            <Skeleton className="h-5 w-40 rounded-lg" />
            <Skeleton className="h-4 w-72 rounded-lg" />
          </div>
          <Skeleton className="h-9 w-44 shrink-0 rounded-lg" />
        </div>

        <Skeleton className="mt-4 h-10 w-full rounded-lg" />

        <div className="mt-4 flex gap-2">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-8 w-20 rounded-lg" />
          ))}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-40 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  )
}

function ProvidersCard({
  count,
  description,
  icon,
  providers,
  title,
  variant,
  onConnect,
  onSync,
  syncingSlug,
  detailBasePath,
  actions,
  selectableIds,
  selectedIds,
  onToggleSelect,
}: {
  count: number
  description: string
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
  providers: Models.Provider[]
  title: string
  variant: 'connected' | 'available'
  onConnect?: (provider: Models.Provider) => void
  onSync?: (provider: Models.Provider) => void
  syncingSlug?: string | null
  detailBasePath?: string
  actions?: React.ReactNode
  selectableIds?: Set<string>
  selectedIds?: Set<string>
  onToggleSelect?: (id: string) => void
}) {
  return (
    <Card className="bg-background">
      <CardHeader className="h-20">
        <div className="flex items-center gap-3.5">
          <IconBadge icon={icon} variant="soft" className="h-10 w-10" iconClassName="h-5 w-5" />
          <CardHeading>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeading>
        </div>
        <CardToolbar>
          {actions}
          <Badge variant="secondary" size="sm" className="tabular-nums">
            {count}
          </Badge>
        </CardToolbar>
      </CardHeader>
      <CardContent className="p-0">
        <ProviderGrid
          providers={providers}
          variant={variant}
          onConnect={onConnect}
          onSync={onSync}
          syncingSlug={syncingSlug}
          detailBasePath={detailBasePath}
          selectableIds={selectableIds}
          selectedIds={selectedIds}
          onToggleSelect={onToggleSelect}
        />
      </CardContent>
    </Card>
  )
}

function RouteComponent() {
  const [search, setSearch] = useState('')
  const [categoryValue, setCategoryValue] = useState<string>(CATEGORIES[0].value)
  const category = CATEGORIES.find((c) => c.value === categoryValue) ?? CATEGORIES[0]
  const [createOpen, setCreateOpen] = useState(false)
  const [createPreset, setCreatePreset] = useState<{ slug: string; api_kind: string } | undefined>(
    undefined
  )
  const [keyProvider, setKeyProvider] = useState<{ slug: string; name: string } | null>(null)
  const [modeProvider, setModeProvider] = useState<{ slug: string; name: string } | null>(null)
  const [syncingSlug, setSyncingSlug] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
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

  const counts = useMemo(() => {
    const all = [...(overview?.connected ?? []), ...(overview?.available ?? [])]
    return Object.fromEntries(
      CATEGORIES.map((c) => [c.value, all.filter((provider) => inCategory(provider, c)).length])
    )
  }, [overview])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    const matches = (provider: Models.Provider) =>
      inCategory(provider, category) &&
      (!query || `${provider.name} ${provider.slug}`.toLowerCase().includes(query))

    return {
      connected: (overview?.connected ?? []).filter(matches),
      available: (overview?.available ?? []).filter(matches),
    }
  }, [overview, search, category])

  // Only empty providers in the current view can be selected, so a hidden or
  // since-connected provider never rides along in a bulk delete.
  const emptyProviders = filtered.connected.filter(isEmptyProvider)
  const emptyIds = new Set(emptyProviders.map((provider) => provider.id))
  const selectedEmpty = emptyProviders.filter((provider) => selected.has(provider.id))

  if (!overview) {
    return <RouteSkeleton />
  }

  const toggleSelect = (id: string) => {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
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
          setSelected(new Set())
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
    setSyncingSlug(slug)
    try {
      const result = await services.providers.modelsSync(slug)
      const payload = result.data.data
      toast.success(
        `Synced ${payload.models.length} models from upstream` +
          (payload.priced ? ` · ${payload.priced} priced` : '')
      )
    } catch (error) {
      toastAxiosError(error)
    } finally {
      setSyncingSlug(null)
    }
  }

  return (
    <>
      <SectionCard
        title="Providers"
        description="Connect and manage AI providers to power your routing."
        toolbar={
          <Button
            className="bg-amber-600 text-white hover:bg-amber-500 dark:bg-amber-800 dark:text-amber-200 dark:hover:bg-amber-700"
            onClick={handleNewProvider}
          >
            <IconPlus />
            <span>New custom provider</span>
          </Button>
        }
      >
        <div className="space-y-4">
          <InputWrapper variant="lg" className="rounded-lg">
            <IconSearch />
            <Input
              aria-label="Search providers"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search providers..."
              value={search}
            />
          </InputWrapper>

          <Tabs value={category.value} onValueChange={setCategoryValue}>
            <TabsList className="w-full justify-start overflow-x-auto">
              {CATEGORIES.map((c) => (
                <TabsTrigger key={c.value} value={c.value}>
                  <c.icon />
                  {c.label}
                  <span className="text-[10px] leading-none font-medium tabular-nums opacity-60">
                    {counts[c.value] ?? 0}
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <ProvidersCard
            count={filtered.connected.length}
            description="These providers have accounts and are ready to use."
            icon={IconPlugConnected}
            providers={filtered.connected}
            title="Connected providers"
            variant="connected"
            detailBasePath="/providers"
            selectableIds={emptyIds}
            selectedIds={selected}
            onToggleSelect={toggleSelect}
            actions={
              emptyProviders.length > 0 ? (
                <>
                  {selectedEmpty.length > 0 ? (
                    <>
                      <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
                        Clear
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="text-white"
                        disabled={bulkDelete.isPending}
                        onClick={() => setPendingDelete(selectedEmpty)}
                      >
                        <IconTrash />
                        Delete selected ({selectedEmpty.length})
                      </Button>
                    </>
                  ) : null}
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={bulkDelete.isPending}
                    onClick={() => setPendingDelete(emptyProviders)}
                  >
                    <IconTrash />
                    Delete empty ({emptyProviders.length})
                  </Button>
                </>
              ) : null
            }
            onSync={(provider) => {
              if (API_KEY_PROVIDERS[provider.slug]) {
                void syncModels(provider.slug)
              }
            }}
            syncingSlug={syncingSlug}
          />

          <ProvidersCard
            count={filtered.available.length}
            description="Add new providers to expand your routing options."
            icon={IconApps}
            providers={filtered.available}
            title="Available providers"
            variant="available"
            onConnect={handleConnect}
          />
        </div>
      </SectionCard>

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
