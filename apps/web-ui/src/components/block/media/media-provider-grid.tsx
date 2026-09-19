import { IconArrowRight, IconBrandGithub } from '@tabler/icons-react'

import type { MediaCapability, MediaProvider } from '@/lib/api/models/media'

import { Icons } from '@/components/block/common/icons'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { cn } from '@/lib/utils'

const CAPABILITY_LABELS: Record<MediaCapability, string> = {
  embed: 'Embed',
  image: 'Image',
  tts: 'TTS',
  stt: 'STT',
  search: 'Search',
  fetch: 'Fetch',
  image_to_text: 'image_to_text',
}

type Brand = {
  icon?: React.ComponentType<React.SVGProps<SVGSVGElement>>
  letter?: string
  tileClassName?: string
}

const BRANDS: Record<string, Brand> = {
  openrouter: { letter: 'O', tileClassName: 'bg-slate-600 text-white' },
  nvidia: { letter: 'N', tileClassName: 'bg-lime-600 text-white' },
  vllm: { letter: 'V', tileClassName: 'bg-orange-500 text-white' },
  gemini: {
    letter: 'G',
    tileClassName: 'bg-gradient-to-br from-sky-400 via-indigo-400 to-fuchsia-400 text-white',
  },
  github: { icon: IconBrandGithub, tileClassName: 'bg-zinc-800 text-white' },
  openai: { icon: Icons.chatgpt, tileClassName: 'bg-white text-zinc-900' },
  mistral: {
    letter: 'M',
    tileClassName: 'bg-gradient-to-br from-orange-500 to-red-500 text-white',
  },
  together: { letter: 'T', tileClassName: 'bg-white text-zinc-900' },
  fireworks: { letter: 'F', tileClassName: 'bg-rose-500 text-white' },
  nebius: { letter: 'N', tileClassName: 'bg-lime-300 text-zinc-900' },
  venice: { letter: 'V', tileClassName: 'bg-red-500 text-white' },
  'voyage-ai': { letter: 'V', tileClassName: 'bg-zinc-100 text-zinc-900' },
  'jina-ai': { letter: 'J', tileClassName: 'bg-zinc-900 text-white' },
}

function ProviderAvatar({ slug }: { slug: string }) {
  const brand = BRANDS[slug] ?? { letter: slug.charAt(0).toUpperCase() }

  return (
    <span
      className={cn(
        'flex h-11 w-11 shrink-0 items-center justify-center rounded-lg',
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

interface MediaProviderGridProps {
  providers: MediaProvider[]
}

export default function MediaProviderGrid({ providers }: MediaProviderGridProps) {
  if (providers.length === 0) {
    return (
      <div className="p-8">
        <Empty>
          <EmptyHeader>
            <EmptyTitle>No providers available</EmptyTitle>
            <EmptyDescription>Providers for this capability will appear here.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-px overflow-hidden rounded-b-xl bg-border lg:grid-cols-2">
      {providers.map((provider) => (
        <div key={provider.id} className="flex items-center gap-4 bg-card p-5">
          <ProviderAvatar slug={provider.slug} />

          <div className="min-w-0 flex-1 space-y-1.5">
            <p className="truncate text-sm font-semibold text-foreground">{provider.name}</p>
            <p className="truncate font-mono text-xs text-muted-foreground">{provider.slug}</p>
            <div className="flex flex-wrap gap-1.5">
              {provider.capabilities.map((capability) => (
                <span
                  key={capability}
                  className="inline-flex items-center rounded-md bg-emerald-950/40 px-2 py-0.5 text-xs font-medium text-emerald-400 ring-1 ring-emerald-900/60 ring-inset"
                >
                  {CAPABILITY_LABELS[capability]}
                </span>
              ))}
            </div>
          </div>

          <IconArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        </div>
      ))}
    </div>
  )
}
