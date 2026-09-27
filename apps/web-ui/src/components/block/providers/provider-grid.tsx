import {
  IconAlertTriangle,
  IconPlugConnected,
  IconPlus,
  IconSearch,
} from '@tabler/icons-react'

import type { Models } from '@/lib/api/models'

import { Icons } from '@/components/block/common/icons'
import { Badge, BadgeDot } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { cn } from '@/lib/utils'

type Brand = {
  icon?: React.ComponentType<React.SVGProps<SVGSVGElement>>
  letter?: string
  tileClassName?: string
}

function getBrand(slug: string): Brand {
  if (slug === 'mimo-free') {
    return { letter: 'm', tileClassName: 'bg-orange-500 text-white' }
  }
  if (slug.includes('openai')) {
    return { icon: Icons.chatgpt }
  }
  if (slug.includes('anthropic') || slug === 'claude') {
    return { icon: Icons.claude }
  }

  return { letter: slug.charAt(0).toUpperCase() }
}

function ProviderAvatar({ slug }: { slug: string }) {
  const brand = getBrand(slug)

  return (
    <span
      className={cn(
        'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-zinc-900 ring-1 ring-border',
        brand.tileClassName
      )}
    >
      {brand.icon ? (
        <brand.icon className="h-5 w-5" />
      ) : (
        <span className="text-sm font-bold">{brand.letter}</span>
      )}
    </span>
  )
}

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
}

export default function ProviderGrid({ providers, variant, onConnect }: ProviderGridProps) {
  if (providers.length === 0) {
    return <EmptyState variant={variant} />
  }

  return (
    <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
      {providers.map((provider) => (
        <div
          key={provider.id}
          className="group relative flex flex-col rounded-xl border border-border bg-card p-4 transition-[border-color,box-shadow] hover:border-ring/50 hover:shadow-xs"
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

          <ProviderAvatar slug={provider.slug} />

          <div className="mt-3 min-w-0 space-y-0.5">
            <p className="truncate text-sm font-semibold text-foreground">{provider.name}</p>
            <p className="truncate font-mono text-xs text-muted-foreground">{provider.slug}</p>
          </div>

          <div className="mt-auto pt-3">
            {variant === 'connected' ? (
              <p className="text-xs text-muted-foreground">
                {provider.accounts ?? 0}{' '}
                {(provider.accounts ?? 0) === 1 ? 'account' : 'accounts'}
              </p>
            ) : (
              <Button variant="outline" size="sm" onClick={() => onConnect?.(provider)}>
                <IconPlus />
                <span>Connect</span>
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
