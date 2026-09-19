import { IconAlertTriangle } from '@tabler/icons-react'

import type { Models } from '@/lib/api/models'

import { Icons } from '@/components/block/common/icons'
import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
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
        'flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white text-zinc-900',
        brand.tileClassName
      )}
    >
      {brand.icon ? (
        <brand.icon className="h-6 w-6" />
      ) : (
        <span className="text-sm font-bold">{brand.letter}</span>
      )}
    </span>
  )
}

interface ProviderGridProps {
  providers: Models.Provider[]
  variant: 'connected' | 'available'
}

export default function ProviderGrid({ providers, variant }: ProviderGridProps) {
  if (providers.length === 0) {
    return (
      <div className="p-8">
        <Empty>
          <EmptyHeader>
            <EmptyTitle>No providers found</EmptyTitle>
            <EmptyDescription>Try a different search or capability.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-px overflow-hidden rounded-b-xl bg-border sm:grid-cols-2 lg:grid-cols-4">
      {providers.map((provider) => (
        <div key={provider.id} className="relative bg-card p-5">
          {variant === 'connected' ? (
            <span className="absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-emerald-950/40 px-2 py-0.5 text-xs font-medium text-emerald-400 ring-1 ring-emerald-900/60 ring-inset">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              Connected
            </span>
          ) : provider.official === false ? (
            <span className="absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-amber-950/40 px-2 py-0.5 text-xs font-medium text-amber-400 ring-1 ring-amber-900/60 ring-inset">
              <IconAlertTriangle className="h-3 w-3" />
              unofficial
            </span>
          ) : null}

          <ProviderAvatar slug={provider.slug} />

          <div className="mt-4 space-y-1">
            <p className="truncate text-sm font-semibold text-foreground">{provider.name}</p>
            <p className="truncate font-mono text-xs text-muted-foreground">{provider.slug}</p>
            {variant === 'connected' ? (
              <p className="text-muted-foreground text-xs">
                {provider.accounts} {provider.accounts === 1 ? 'account' : 'accounts'}
              </p>
            ) : (
              <Button variant="dim" size="sm" className="h-auto p-0">
                Connect
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
