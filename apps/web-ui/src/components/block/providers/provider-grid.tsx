import {
  IconAlertTriangle,
  IconArrowUpRight,
  IconPlugConnected,
  IconPlus,
  IconSearch,
} from '@tabler/icons-react'
import { Link } from '@tanstack/react-router'

import type { Models } from '@/lib/api/models'

import { ProviderAvatar } from '@/components/block/providers/provider-avatar'
import { Badge, BadgeDot } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { cn } from '@/lib/utils'

function EmptyState({ variant }: { variant: 'connected' | 'available' }) {
  const isConnected = variant === 'connected'

  return (
    <div className="p-4">
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            {isConnected ? <IconPlugConnected /> : <IconSearch />}
          </EmptyMedia>
          <EmptyTitle>
            {isConnected ? 'No connected providers yet' : 'No providers found'}
          </EmptyTitle>
          <EmptyDescription>
            {isConnected
              ? 'Providers with linked accounts will show up here.'
              : 'Try a different search or capability filter.'}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    </div>
  )
}

interface ProviderGridProps {
  providers: Models.Provider[]
  variant: 'connected' | 'available'
  onConnect?: (provider: Models.Provider) => void
  detailBasePath?: string
}

export default function ProviderGrid({
  providers,
  variant,
  onConnect,
  detailBasePath,
}: ProviderGridProps) {
  if (providers.length === 0) {
    return <EmptyState variant={variant} />
  }

  return (
    <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
      {providers.map((provider) => {
        const detailPath =
          detailBasePath && !provider.id.startsWith('prov-')
            ? `${detailBasePath}/${provider.id}`
            : null

        return (
          <div
            key={provider.id}
            className={cn(
              'group relative flex flex-col rounded-xl border border-border bg-card p-4 transition-[border-color,box-shadow] hover:border-ring/50 hover:shadow-xs',
              detailPath && 'hover:-translate-y-0.5'
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
                <p className="text-xs text-muted-foreground">
                  {provider.accounts ?? 0} {(provider.accounts ?? 0) === 1 ? 'account' : 'accounts'}
                </p>
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
