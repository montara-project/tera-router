import {
  IconAlertTriangle,
  IconCheck,
  IconKey,
  IconLogin2,
  IconPlug,
  IconPlus,
  IconSearch,
  IconX,
} from '@tabler/icons-react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useState } from 'react'

import type { Models } from '@/lib/api/models'

import { ProviderAvatar } from '@/components/block/providers/provider-avatar'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input, InputWrapper } from '@/components/ui/input'
import { useDebounce } from '@/hooks/use-debounce'
import { queries } from '@/lib/api/queries'
import { cn } from '@/lib/utils'

import {
  API_KEY_PROVIDERS,
  CUSTOM_CONNECT_PRESETS,
  KEY_ONLY_PROVIDERS,
  OAUTH_FLOW_FOR,
} from './catalog-connect'

/** Capability filters shared by the connected table and this dialog. */
export const PROVIDER_CAPABILITIES: { value: Models.ProviderCapability; label: string }[] = [
  { value: 'chat', label: 'Chat' },
  { value: 'embeddings', label: 'Embeddings' },
  { value: 'image', label: 'Image' },
  { value: 'stt', label: 'Speech-to-text' },
  { value: 'tts', label: 'Text-to-speech' },
  { value: 'search', label: 'Search' },
  { value: 'fetch', label: 'Fetch' },
]

/**
 * Custom endpoints are the two presets plus any provider outside the built-in
 * catalog. Connected catalog providers also get a uuid row, so the id alone
 * cannot tell them apart.
 */
const isCustom = (p: Models.Provider) =>
  Boolean(CUSTOM_CONNECT_PRESETS[p.slug]) ||
  (!p.id.startsWith('prov-') &&
    !API_KEY_PROVIDERS[p.slug] &&
    !KEY_ONLY_PROVIDERS[p.slug] &&
    !OAUTH_FLOW_FOR[p.slug])

const GROUPS = [
  { key: 'custom', label: 'Custom endpoints', icon: IconPlug, match: isCustom },
  {
    key: 'signin',
    label: 'Sign in or use an API key',
    icon: IconLogin2,
    match: (p: Models.Provider) => !isCustom(p) && Boolean(OAUTH_FLOW_FOR[p.slug]),
  },
  {
    key: 'apikey',
    label: 'API key',
    icon: IconKey,
    match: (p: Models.Provider) => !isCustom(p) && !OAUTH_FLOW_FOR[p.slug],
  },
]

interface ConnectProviderDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConnect: (provider: Models.Provider) => void
  onNewCustom: () => void
}

export default function ConnectProviderDialog({
  open,
  onOpenChange,
  onConnect,
  onNewCustom,
}: ConnectProviderDialogProps) {
  const [search, setSearch] = useState('')
  const [capability, setCapability] = useState<Models.ProviderCapability | 'all'>('all')

  // The server applies the search and the capability filter.
  const q = useDebounce({ value: search.trim(), delay: 300 })
  const { data } = useQuery({
    ...queries.providers.list({
      search: q || undefined,
      capability: capability === 'all' ? undefined : capability,
    }),
    enabled: open,
    placeholderData: keepPreviousData,
  })
  const overview = data?.data
  const connectedIds = new Set((overview?.connected ?? []).map((p) => p.id))
  const shown = [...(overview?.connected ?? []), ...(overview?.available ?? [])]
  const providerCount = (overview?.connected_count ?? 0) + (overview?.available_count ?? 0)

  const close = () => {
    onOpenChange(false)
    setSearch('')
    setCapability('all')
  }

  return (
    <AlertDialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <AlertDialogContent className="flex max-h-[90vh] max-w-3xl flex-col gap-0 overflow-hidden p-0">
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
          <AlertDialogTitle className="text-[15px]">Connect a provider</AlertDialogTitle>
          <AlertDialogDescription className="sr-only">
            Pick a provider to connect, or add a custom endpoint.
          </AlertDialogDescription>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground"
            aria-label="Close"
            onClick={close}
          >
            <IconX className="size-4" />
          </Button>
        </div>

        <div className="space-y-3 border-b border-border px-5 py-3">
          <InputWrapper>
            <IconSearch aria-hidden />
            <Input
              type="search"
              aria-label="Search providers"
              placeholder={`Search ${providerCount} providers`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </InputWrapper>
          <div role="group" aria-label="Capability" className="flex flex-wrap gap-1.5">
            {[{ value: 'all' as const, label: 'All' }, ...PROVIDER_CAPABILITIES].map((c) => {
              const active = capability === c.value
              return (
                <button
                  key={c.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setCapability(c.value)}
                  className={cn(
                    'h-7 rounded-md border px-2.5 text-[12.5px] font-medium',
                    active
                      ? 'border-primary/40 bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:text-foreground'
                  )}
                >
                  {c.label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="scrollbar-seamless min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-5 py-4">
          {overview && shown.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No provider matches that search. Add it as a custom endpoint instead.
            </p>
          )}
          {GROUPS.map((group) => {
            const rows = shown.filter(group.match)
            if (rows.length === 0) return null
            return (
              <section key={group.key} aria-label={group.label}>
                <h3 className="mb-1.5 flex items-center gap-2 px-2 text-[13px] font-semibold">
                  <group.icon className="text-primary size-4" aria-hidden />
                  {group.label}
                  <span className="font-normal text-muted-foreground tabular-nums">
                    {rows.length}
                  </span>
                </h3>
                <ul className="grid gap-x-2 sm:grid-cols-2">
                  {rows.map((p) => (
                    <li key={p.id}>
                      <ProviderRow
                        provider={p}
                        connected={connectedIds.has(p.id)}
                        onConnect={() => {
                          close()
                          onConnect(p)
                        }}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border bg-muted/40 px-5 py-3">
          <span className="text-[13px] text-muted-foreground">Not listed?</span>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              close()
              onNewCustom()
            }}
          >
            <IconPlus />
            New custom provider
          </Button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function ProviderRow({
  provider,
  connected,
  onConnect,
}: {
  provider: Models.Provider
  connected: boolean
  onConnect: () => void
}) {
  const accounts = provider.accounts ?? 0
  const body = (
    <>
      <ProviderAvatar
        slug={provider.slug}
        apiKind={provider.api_kind}
        size="xs"
        className="size-6"
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium" title={provider.name}>
          {provider.name}
        </span>
        <span className="block truncate text-[11.5px] text-muted-foreground">
          {connected
            ? `${accounts} ${accounts === 1 ? 'account' : 'accounts'} · add another`
            : provider.slug}
        </span>
      </span>
      {connected ? (
        <span className="inline-flex shrink-0 items-center gap-1 rounded-sm bg-emerald-500/10 px-1.5 py-0.5 text-[11.5px] font-medium text-emerald-700 ring-1 ring-emerald-500/25 ring-inset dark:text-emerald-400">
          <IconCheck className="size-3" aria-hidden />
          Connected
        </span>
      ) : provider.official === false ? (
        <span className="inline-flex shrink-0 items-center gap-1 rounded-sm bg-amber-500/10 px-1.5 py-0.5 text-[11.5px] font-medium text-amber-800 ring-1 ring-amber-500/25 ring-inset dark:text-amber-400">
          <IconAlertTriangle className="size-3" aria-hidden />
          Unofficial
        </span>
      ) : null}
    </>
  )
  const className =
    'flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden'

  // Connected providers add accounts from their detail page.
  return connected ? (
    <Link to="/providers/$providerId" params={{ providerId: provider.id }} className={className}>
      {body}
    </Link>
  ) : (
    <button type="button" onClick={onConnect} className={className}>
      {body}
    </button>
  )
}
