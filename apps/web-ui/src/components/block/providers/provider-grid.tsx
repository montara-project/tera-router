import {
  IconAlertTriangle,
  IconArrowUpRight,
  IconPlugConnected,
  IconPlus,
  IconRefresh,
  IconSearch,
} from '@tabler/icons-react'
import { Link } from '@tanstack/react-router'

import type { Models } from '@/lib/api/models'

import EmptyState from '@/components/block/common/empty-state'
import { ProviderAvatar } from '@/components/block/providers/provider-avatar'
import { Badge, BadgeDot } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'

const EMPTY_COPY = {
  connected: {
    icon: IconPlugConnected,
    title: 'No connected providers yet',
    description: 'Providers with linked accounts will show up here.',
  },
  available: {
    icon: IconSearch,
    title: 'No providers found',
    description: 'Try a different search or capability filter.',
  },
} as const

interface ProviderGridProps {
  providers: Models.Provider[]
  variant: 'connected' | 'available'
  onConnect?: (provider: Models.Provider) => void
  /** Re-sync the stored model catalog (providers that support it). */
  onSync?: (provider: Models.Provider) => void
  syncingSlug?: string | null
  detailBasePath?: string
  /** Ids that can be selected for deletion (providers without any account). */
  selectableIds?: Set<string>
  selectedIds?: Set<string>
  onToggleSelect?: (id: string) => void
}

export default function ProviderGrid({
  providers,
  variant,
  onConnect,
  onSync,
  syncingSlug,
  detailBasePath,
  selectableIds,
  selectedIds,
  onToggleSelect,
}: ProviderGridProps) {
  if (providers.length === 0) {
    return (
      <div className="p-4">
        <EmptyState className="border" {...EMPTY_COPY[variant]} />
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
      {providers.map((provider) => {
        // Catalog providers carry "prov-<slug>" ids; custom providers carry
        // uuids — the detail route serves both.
        const detailPath = detailBasePath ? `${detailBasePath}/${provider.id}` : null
        const selectable = Boolean(onToggleSelect && selectableIds?.has(provider.id))
        const selected = selectable && Boolean(selectedIds?.has(provider.id))

        return (
          <div
            key={provider.id}
            className={cn(
              'group relative flex flex-col rounded-xl border border-border bg-card p-4 transition-[border-color,box-shadow] hover:border-ring/50 hover:shadow-xs',
              detailPath && 'hover:-translate-y-0.5',
              selected && 'border-destructive/60 ring-1 ring-destructive/40'
            )}
          >
            {variant === 'connected' ? (
              <Badge
                variant="success"
                appearance="light"
                size="sm"
                shape="circle"
                className="absolute right-3 top-3"
              >
                <BadgeDot />
                Connected
              </Badge>
            ) : provider.official === false ? (
              <Badge
                variant="warning"
                appearance="light"
                size="sm"
                shape="circle"
                className="absolute right-3 top-3"
              >
                <IconAlertTriangle />
                unofficial
              </Badge>
            ) : null}

            <ProviderAvatar slug={provider.slug} apiKind={provider.api_kind} />

            <div className="mt-3 min-w-0 space-y-0.5">
              <p className="truncate text-sm font-semibold text-foreground">{provider.name}</p>
              <p className="truncate font-mono text-xs text-muted-foreground">{provider.slug}</p>
            </div>

            <div className="mt-auto flex items-center justify-between gap-2 pt-3">
              {variant === 'connected' ? (
                <div className="flex items-center gap-1.5">
                  {selectable ? (
                    <Checkbox
                      size="sm"
                      checked={selected}
                      onCheckedChange={() => onToggleSelect?.(provider.id)}
                      aria-label={`Select ${provider.name} for deletion`}
                    />
                  ) : null}
                  <p className="text-xs text-muted-foreground">
                    {provider.accounts ?? 0}{' '}
                    {(provider.accounts ?? 0) === 1 ? 'account' : 'accounts'}
                  </p>
                  {onSync ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-6"
                      aria-label={`Sync models for ${provider.name}`}
                      disabled={syncingSlug === provider.slug}
                      onClick={() => onSync(provider)}
                    >
                      <IconRefresh
                        className={cn('size-3.5', syncingSlug === provider.slug && 'animate-spin')}
                      />
                    </Button>
                  ) : null}
                </div>
              ) : (
                <Button variant="outline" size="sm" onClick={() => onConnect?.(provider)}>
                  <IconPlus />
                  <span>Connect</span>
                </Button>
              )}
              {detailPath ? (
                <Link
                  to={detailPath}
                  aria-label={`View details for ${provider.name}`}
                  className="inline-flex min-h-8 items-center gap-1 rounded-md px-2 text-xs font-medium text-emerald-500 transition-colors hover:bg-accent hover:text-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  View details
                  <IconArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </Link>
              ) : null}
            </div>
          </div>
        )
      })}
    </div>
  )
}
