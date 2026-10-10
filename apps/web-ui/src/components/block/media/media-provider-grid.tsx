import { Link } from '@tanstack/react-router'

import type { MediaCapability, MediaProvider } from '@/lib/api/models/media'
import type { Provider } from '@/lib/api/models/provider'

import { Icons } from '@/components/block/common/icons'
import { Badge, BadgeDot } from '@/components/ui/badge'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { cn } from '@/lib/utils'

const CAPABILITY_LABELS: Record<MediaCapability, string> = {
  embed: 'Embed',
  image: 'Image',
  tts: 'TTS',
  stt: 'STT',
  search: 'Search',
  fetch: 'Fetch',
  image_to_text: 'Image to Text',
}

type Brand = {
  icon?: React.ComponentType<React.SVGProps<SVGSVGElement>>
  letter?: string
  tileClassName?: string
}

const BRANDS: Record<string, Brand> = {
  openrouter: { icon: Icons.openrouter, tileClassName: 'bg-white text-black' },
  nvidia: { icon: Icons.nvidia, tileClassName: 'bg-white' },
  gemini: { icon: Icons.gemini, tileClassName: 'bg-white' },

  openai: { icon: Icons.openai, tileClassName: 'bg-white text-black' },
  mistral: { icon: Icons.mistral, tileClassName: 'bg-white' },
  together: { icon: Icons.together, tileClassName: 'bg-white text-black' },
  fireworks: { icon: Icons.fireworks, tileClassName: 'bg-white' },
  nebius: { icon: Icons.nebius, tileClassName: 'bg-white text-black' },
  'voyage-ai': { icon: Icons.voyage, tileClassName: 'bg-white' },
  'jina-ai': { icon: Icons.jina, tileClassName: 'bg-white text-black' },
}

function ProviderAvatar({ slug }: { slug: string }) {
  const brand = BRANDS[slug] ?? { letter: slug.charAt(0).toUpperCase() }

  return (
    <span
      className={cn(
        'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ring-1 ring-border',
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

interface MediaProviderGridProps {
  providers: MediaProvider[]
  /** Entries from the providers overview keyed by slug, for status and detail links. */
  connections: Record<string, Provider>
  emptyIcon?: React.ComponentType<React.SVGProps<SVGSVGElement>>
}

const CARD_CLASS_NAME =
  'flex items-center gap-4 rounded-xl border border-border bg-card p-4 transition-[border-color,box-shadow] hover:border-ring/50 hover:shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

export default function MediaProviderGrid({
  providers,
  connections,
  emptyIcon,
}: MediaProviderGridProps) {
  if (providers.length === 0) {
    const EmptyIcon = emptyIcon

    return (
      <div className="p-4">
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">{EmptyIcon ? <EmptyIcon /> : null}</EmptyMedia>
            <EmptyTitle>No providers available</EmptyTitle>
            <EmptyDescription>Providers for this capability will appear here.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
      {providers.map((provider) => {
        const connection = connections[provider.slug]
        const accounts = connection?.accounts ?? 0

        const content = (
          <>
            <ProviderAvatar slug={provider.slug} />

            <div className="min-w-0 flex-1 space-y-1">
              <p className="truncate text-sm font-semibold text-foreground">{provider.name}</p>
              <p className="truncate font-mono text-xs text-muted-foreground">{provider.slug}</p>
              <div className="flex flex-wrap gap-1.5">
                {provider.capabilities.map((capability) => (
                  <Badge key={capability} variant="success" appearance="light" size="sm">
                    {CAPABILITY_LABELS[capability]}
                  </Badge>
                ))}
              </div>
            </div>

            {connection?.connected ? (
              <Badge variant="success" appearance="light" size="sm" shape="circle">
                <BadgeDot />
                {accounts} {accounts === 1 ? 'account' : 'accounts'}
              </Badge>
            ) : (
              <Badge variant="secondary" size="sm" shape="circle">
                Not connected
              </Badge>
            )}
          </>
        )

        // Providers missing from the overview have no detail page; send them
        // to the providers list, where they can be added as custom.
        return connection ? (
          <Link
            key={provider.id}
            to="/providers/$providerId"
            params={{ providerId: connection.id }}
            className={CARD_CLASS_NAME}
          >
            {content}
          </Link>
        ) : (
          <Link key={provider.id} to="/providers" className={CARD_CLASS_NAME}>
            {content}
          </Link>
        )
      })}
    </div>
  )
}
