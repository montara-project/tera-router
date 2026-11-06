import { Link } from '@tanstack/react-router'

import type { MediaCapability, MediaCategory, MediaProvider } from '@/lib/api/models/media'
import type { Provider } from '@/lib/api/models/provider'

import { ProviderAvatar } from '@/components/block/providers/provider-avatar'

export const CAPABILITY_LABELS: Record<MediaCapability, string> = {
  embed: 'Embed',
  image: 'Image',
  tts: 'TTS',
  stt: 'STT',
  search: 'Search',
  fetch: 'Fetch',
  image_to_text: 'Image to text',
}

const CARD =
  'flex min-w-0 items-center gap-3 rounded-lg border border-border bg-card px-[13px] py-[11px] transition-colors hover:border-ring/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden'

/** Section title with a teal icon and a muted line under it (e.g. the count). */
export function MediaSectionHeader({
  icon: Icon,
  title,
  detail,
}: {
  icon: React.ElementType
  title: string
  detail: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-2.5">
      <Icon className="size-4 shrink-0 text-teal-600 dark:text-teal-400" aria-hidden />
      <div>
        <h2 className="text-[13px] font-semibold">{title}</h2>
        <p className="text-xs text-muted-foreground tabular-nums">{detail}</p>
      </div>
    </div>
  )
}

interface MediaProviderGridProps {
  providers: MediaProvider[]
  /** Entries from the providers overview keyed by slug, for account counts and detail links. */
  connections: Record<string, Provider>
  /** Category the page shows; the detail page opens on it. */
  category: MediaCategory
}

/** Compact provider cards, four per row on wide screens. */
export default function MediaProviderGrid({
  providers,
  connections,
  category,
}: MediaProviderGridProps) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {providers.map((provider) => {
        const connection = connections[provider.slug]
        const accounts = connection?.connected ? (connection.accounts ?? 0) : 0
        const detail = [
          provider.slug,
          accounts > 0 && `${accounts} ${accounts === 1 ? 'account' : 'accounts'}`,
          ...provider.capabilities.map((c) => CAPABILITY_LABELS[c]),
        ]
          .filter(Boolean)
          .join(' · ')

        const content = (
          <>
            <ProviderAvatar slug={provider.slug} size="sm" className="size-7 rounded-sm" />
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-medium">{provider.name}</span>
              <span className="block truncate text-[11.5px] text-muted-foreground" title={detail}>
                {detail}
              </span>
            </span>
          </>
        )

        return (
          <li key={provider.id} className="min-w-0">
            <Link
              to="/media/$slug"
              params={{ slug: provider.slug }}
              search={{ category }}
              className={CARD}
            >
              {content}
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
