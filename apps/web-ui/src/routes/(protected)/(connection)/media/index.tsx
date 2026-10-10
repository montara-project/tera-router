import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useMemo, useState } from 'react'

import type { MediaCategory } from '@/lib/api/models/media'
import type { Provider } from '@/lib/api/models/provider'

import IconBadge from '@/components/block/common/icon-badge'
import SectionCard from '@/components/block/common/section-card'
import MediaProviderGrid from '@/components/block/media/media-provider-grid'
import MediaTabs, { MEDIA_CATEGORIES } from '@/components/block/media/media-tabs'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardHeading,
  CardTitle,
  CardToolbar,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { mediaQueries } from '@/lib/api/queries/media'
import { providerQueries } from '@/lib/api/queries/provider'

export const Route = createFileRoute('/(protected)/(connection)/media/')({
  component: RouteComponent,
})

function RouteSkeleton() {
  return (
    <div className="bg-sidebar border border-sidebar-accent p-2 rounded-2xl">
      <div className="rounded-lg border border-border bg-background p-4">
        <div className="flex gap-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-8 w-24 rounded-lg" />
          ))}
        </div>

        <div className="mt-4 flex items-center gap-3.5 rounded-xl border border-border p-4">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-48 rounded-lg" />
            <Skeleton className="h-3 w-72 rounded-lg" />
          </div>
          <Skeleton className="h-5 w-8 rounded-sm" />
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-[76px] rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  )
}

function RouteComponent() {
  const [category, setCategory] = useState<MediaCategory>('embeddings')

  const { data } = useQuery(mediaQueries.list())
  const { data: providerData } = useQuery(providerQueries.list())

  const connections = useMemo(() => {
    const overview = providerData?.data
    const map: Record<string, Provider> = {}

    for (const provider of [...(overview?.connected ?? []), ...(overview?.available ?? [])]) {
      map[provider.slug] = provider
    }

    return map
  }, [providerData])

  const counts = useMemo(() => {
    const providers = data?.data.providers ?? []
    const map = {} as Record<MediaCategory, number>

    for (const item of MEDIA_CATEGORIES) {
      const capability = categoryToCapability(item.value)
      map[item.value] = providers.filter((provider) =>
        provider.capabilities.includes(capability)
      ).length
    }

    return map
  }, [data])

  const filtered = useMemo(
    () =>
      (data?.data.providers ?? []).filter((provider) =>
        provider.capabilities.includes(categoryToCapability(category))
      ),
    [data, category]
  )

  if (!data) {
    return <RouteSkeleton />
  }

  const active = MEDIA_CATEGORIES.find((item) => item.value === category)

  return (
    <SectionCard
      title="Media Providers"
      description="Connect providers for embeddings, image generation, speech, and web access."
    >
      <div className="space-y-4">
        <MediaTabs value={category} onChange={setCategory} counts={counts} />

        <Card className="bg-background">
          <CardHeader className="h-20">
            <div className="flex items-center gap-3.5">
              <IconBadge
                icon={active?.icon ?? MEDIA_CATEGORIES[0].icon}
                variant="soft"
                className="h-10 w-10"
                iconClassName="h-5 w-5"
              />
              <CardHeading>
                <CardTitle>{active?.label} providers</CardTitle>
                <CardDescription>{active?.description}</CardDescription>
              </CardHeading>
            </div>
            <CardToolbar>
              <Badge variant="secondary" size="sm" className="tabular-nums">
                {filtered.length}
              </Badge>
            </CardToolbar>
          </CardHeader>
          <CardContent className="p-0">
            <MediaProviderGrid
              providers={filtered}
              connections={connections}
              emptyIcon={active?.icon}
            />
          </CardContent>
        </Card>
      </div>
    </SectionCard>
  )
}

function categoryToCapability(category: MediaCategory) {
  return category === 'embeddings' ? 'embed' : category
}
