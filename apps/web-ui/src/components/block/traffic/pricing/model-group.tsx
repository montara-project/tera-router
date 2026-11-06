'use client'

import { useQuery } from '@tanstack/react-query'

import { ProviderAvatar } from '@/components/block/providers/provider-avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { queries } from '@/lib/api/queries'

interface ModelGroupProps {
  /** provider slug — same value the providers page keys its avatars on */
  slug: string
  title: string
  description: string
}

export default function ModelGroup({ slug, title, description }: ModelGroupProps) {
  // Catalog-provider slugs 404 this endpoint (the repo only stores customs) —
  // the prop fallbacks keep the avatar/title correct for them.
  const { data: provider, isLoading } = useQuery(queries.providers.customGetBySlug(slug))

  if (isLoading) {
    return (
      <div className="flex items-center gap-3" aria-label="Loading provider">
        <Skeleton className="size-6 rounded-md" />
        <div className="flex flex-col justify-center gap-1">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <ProviderAvatar slug={slug} apiKind={provider?.api_kind} size="xs" className="size-6" />
      <span className="min-w-0">
        <span className="block font-medium text-foreground">{provider?.name ?? title}</span>
        <span className="block text-[11.5px] break-all text-muted-foreground">{description}</span>
      </span>
    </div>
  )
}
