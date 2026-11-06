import { IconPhoto, IconPlugConnected, IconPlus, IconSearch } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useMemo, useState } from 'react'

import type { MediaCategory } from '@/lib/api/models/media'
import type { Provider } from '@/lib/api/models/provider'

import PageHeader from '@/components/block/common/page-header'
import MediaProviderGrid, { MediaSectionHeader } from '@/components/block/media/media-provider-grid'
import MediaTabs, { MEDIA_CATEGORIES } from '@/components/block/media/media-tabs'
import { Input, InputWrapper } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { mediaQueries } from '@/lib/api/queries/media'
import { providerQueries } from '@/lib/api/queries/provider'

const CATEGORY_VALUES = MEDIA_CATEGORIES.map((c) => c.value)

export const Route = createFileRoute('/(protected)/(connection)/media/')({
  validateSearch: (search: Record<string, unknown>): { category?: MediaCategory } => ({
    category: CATEGORY_VALUES.includes(search.category as MediaCategory)
      ? (search.category as MediaCategory)
      : undefined,
  }),
  component: RouteComponent,
})

const TEAL_TILE = 'border-transparent bg-teal-500/10 text-teal-600 dark:text-teal-400'

const categoryToCapability = (category: MediaCategory) =>
  category === 'embeddings' ? 'embed' : category

function RouteComponent() {
  const navigate = Route.useNavigate()
  const category = Route.useSearch().category ?? 'embeddings'
  const setCategory = (next: MediaCategory) =>
    void navigate({ search: { category: next === 'embeddings' ? undefined : next }, replace: true })
  const [search, setSearch] = useState('')

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

  const active = MEDIA_CATEGORIES.find((item) => item.value === category) ?? MEDIA_CATEGORIES[0]
  const query = search.trim().toLowerCase()
  const providers = (data?.data.providers ?? []).filter(
    (p) =>
      p.capabilities.includes(categoryToCapability(category)) &&
      (!query || p.name.toLowerCase().includes(query) || p.slug.includes(query))
  )
  const connected = providers.filter((p) => connections[p.slug]?.connected)
  const available = providers.filter((p) => !connections[p.slug]?.connected)
  const noun = active.label.toLowerCase()

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        icon={IconPhoto}
        iconClassName={TEAL_TILE}
        title="Media providers"
        description="Embeddings, image, speech and web providers."
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <MediaTabs value={category} onChange={setCategory} />
        <InputWrapper variant="md" className="w-full rounded-md sm:w-64">
          <IconSearch className="size-4" />
          <Input
            aria-label={`Search ${noun} providers`}
            placeholder={`Search ${noun} providers`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </InputWrapper>
      </div>

      {!data ? (
        <div className="flex flex-col gap-6">
          <Skeleton className="h-40 rounded-lg" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="h-[59px] rounded-lg" />
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <section className="flex flex-col gap-3">
            <MediaSectionHeader
              icon={IconPlugConnected}
              title="Connected"
              detail={connected.length}
            />
            {connected.length > 0 ? (
              <MediaProviderGrid
                providers={connected}
                connections={connections}
                category={category}
              />
            ) : (
              <div className="flex flex-col items-center rounded-lg border border-border bg-card px-6 py-9 text-center">
                <span className="flex size-10 items-center justify-center rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400">
                  <active.icon className="size-5" aria-hidden />
                </span>
                <p className="mt-2.5 text-[13px] font-semibold">
                  {query
                    ? `No connected ${noun} provider matches`
                    : `No ${noun} provider connected`}
                </p>
                <p className="mt-1 text-[12.5px] text-muted-foreground">
                  {query ? 'Try a different search.' : 'Pick one below and add an account.'}
                </p>
              </div>
            )}
          </section>

          <section className="flex flex-col gap-3">
            <MediaSectionHeader icon={IconPlus} title="Add a provider" detail={available.length} />
            {available.length > 0 ? (
              <MediaProviderGrid
                providers={available}
                connections={connections}
                category={category}
              />
            ) : (
              <p className="text-[12.5px] text-muted-foreground">
                {query
                  ? 'No provider matches this search.'
                  : `Every ${noun} provider is connected.`}
              </p>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
