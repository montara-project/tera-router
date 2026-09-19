import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useMemo, useState } from 'react'

import type { MediaCategory } from '@/lib/api/models/media'

import SectionCard from '@/components/block/common/section-card'
import MediaProviderGrid from '@/components/block/media/media-provider-grid'
import MediaTabs, { MEDIA_CATEGORIES } from '@/components/block/media/media-tabs'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardHeading,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { mediaQueries } from '@/lib/api/queries/media'

export const Route = createFileRoute('/(protected)/(connection)/media/')({
  component: RouteComponent,
})

function RouteSkeleton() {
  return (
    <div className="bg-sidebar border border-sidebar-accent p-2 rounded-2xl">
      <div className="space-y-4 rounded-lg border border-border bg-background p-4">
        <Skeleton className="h-9 w-2/3 rounded-lg" />
        <Skeleton className="h-[480px] w-full rounded-lg" />
      </div>
    </div>
  )
}

function RouteComponent() {
  const [category, setCategory] = useState<MediaCategory>('embeddings')

  const { data } = useQuery(mediaQueries.list())

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
        <MediaTabs value={category} onChange={setCategory} />

        <p className="text-muted-foreground text-sm">{active?.description}</p>

        <Card>
          <CardHeader>
            <CardHeading>
              <CardTitle>{active?.label} providers</CardTitle>
              <CardDescription>{filtered.length} available</CardDescription>
            </CardHeading>
          </CardHeader>
          <CardContent className="p-0">
            <MediaProviderGrid providers={filtered} />
          </CardContent>
        </Card>
      </div>
    </SectionCard>
  )
}

function categoryToCapability(category: MediaCategory) {
  return category === 'embeddings' ? 'embed' : category
}
