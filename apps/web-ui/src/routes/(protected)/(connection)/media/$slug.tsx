import {
  IconArrowLeft,
  IconCheck,
  IconCopy,
  IconCpu,
  IconMessageChatbot,
  IconPlus,
  IconRefresh,
  IconSearch,
} from '@tabler/icons-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'

import type { MediaCapability, MediaCategory } from '@/lib/api/models/media'

import SectionCardPanel from '@/components/block/common/section-card-panel'
import { MEDIA_CATEGORIES } from '@/components/block/media/media-tabs'
import AccountsPanel from '@/components/block/provider-detail/accounts-panel'
import { AddCustomProviderApiKeyForm } from '@/components/block/providers/form-provider-api-key'
import { ProviderAvatar } from '@/components/block/providers/provider-avatar'
import { Button } from '@/components/ui/button'
import { Input, InputWrapper } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
import { toastAxiosError } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'
import { ACCOUNT_QUERY_KEY } from '@/lib/api/queries/account'
import { PROVIDER_QUERY_KEY } from '@/lib/api/queries/provider'

const CATEGORY_VALUES = MEDIA_CATEGORIES.map((c) => c.value)
const MODEL_LIMIT = 100

export const Route = createFileRoute('/(protected)/(connection)/media/$slug')({
  validateSearch: (search: Record<string, unknown>): { category?: MediaCategory } => ({
    category: CATEGORY_VALUES.includes(search.category as MediaCategory)
      ? (search.category as MediaCategory)
      : undefined,
  }),
  component: MediaDetailRoute,
})

const toCategory = (capability: MediaCapability): MediaCategory | null =>
  capability === 'embed'
    ? 'embeddings'
    : (CATEGORY_VALUES as string[]).includes(capability)
      ? (capability as MediaCategory)
      : null

const TEAL = 'text-teal-600 dark:text-teal-400'

function MediaDetailRoute() {
  const { slug } = Route.useParams()
  const search = Route.useSearch()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState('accounts')
  const [accountOpen, setAccountOpen] = useState(false)

  const mediaQuery = useQuery(queries.media.list())
  const accountQuery = useQuery(queries.accounts.list({ offset: 0, limit: 100 }))
  const modelsQuery = useQuery(
    queries.providers.catalogModels(slug, { offset: 0, limit: MODEL_LIMIT, state: 'active' })
  )

  const provider = mediaQuery.data?.data.providers.find((p) => p.slug === slug)
  const categories = (provider?.capabilities ?? [])
    .map(toCategory)
    .filter((c): c is MediaCategory => c !== null)
  const category =
    search.category && categories.includes(search.category) ? search.category : categories[0]
  const active = MEDIA_CATEGORIES.find((c) => c.value === category) ?? MEDIA_CATEGORIES[0]

  const accounts = (accountQuery.data?.data ?? []).filter((a) => a.provider === slug)
  const models = modelsQuery.data?.data
  const modelCount = models?.total ?? models?.models.length ?? 0

  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: [PROVIDER_QUERY_KEY] }),
      queryClient.invalidateQueries({ queryKey: [ACCOUNT_QUERY_KEY] }),
    ])

  if (mediaQuery.isLoading) {
    return (
      <div className="flex flex-col gap-5">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-14 w-80" />
        <Skeleton className="h-60 w-full rounded-lg" />
      </div>
    )
  }

  if (!provider) {
    return (
      <div className="flex flex-col items-start gap-3">
        <h1 className="text-xl font-semibold tracking-tight">Media provider not found</h1>
        <p className="text-[13px] text-muted-foreground">
          This provider has no embeddings, image, speech or web capability.
        </p>
        <Button asChild variant="outline">
          <Link to="/media">
            <IconArrowLeft />
            Back to media providers
          </Link>
        </Button>
      </div>
    )
  }

  const countChip = (n: number) => (
    <span className="rounded-sm bg-muted px-1.5 text-[11.5px] text-muted-foreground tabular-nums">
      {n}
    </span>
  )

  return (
    <div className="flex flex-col gap-5">
      <nav aria-label="Breadcrumb">
        <ol className="flex items-center gap-1.5 text-[13px]">
          <li>
            <Link
              to="/media"
              search={{ category: category === 'embeddings' ? undefined : category }}
              className="inline-flex items-center gap-1.5 rounded-sm text-muted-foreground hover:text-foreground"
            >
              <active.icon className="size-3.5" aria-hidden />
              {active.label}
            </Link>
          </li>
          <li aria-hidden className="text-muted-foreground/70">
            /
          </li>
          <li aria-current="page" className="truncate">
            {provider.name}
          </li>
        </ol>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <ProviderAvatar slug={slug} size="md" />
          <div className="min-w-0">
            <h1 className="truncate text-[22px] font-semibold tracking-tight">{provider.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <code className="font-mono text-[12.5px] text-muted-foreground">{slug}</code>
              <span aria-hidden className="text-muted-foreground/70">
                ·
              </span>
              <ul className="flex flex-wrap gap-1.5" aria-label="Capabilities">
                {categories.map((value) => {
                  const c = MEDIA_CATEGORIES.find((m) => m.value === value)!
                  return (
                    <li
                      key={value}
                      className={`inline-flex h-5 items-center gap-1 rounded-sm border border-teal-500/30 bg-teal-500/10 px-[7px] text-[11.5px] font-medium ${TEAL}`}
                    >
                      <c.icon className="size-3" aria-hidden />
                      {c.label}
                    </li>
                  )
                })}
              </ul>
            </div>
          </div>
        </div>
        <Button onClick={() => setAccountOpen(true)}>
          <IconPlus />
          Add account
        </Button>
      </header>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList variant="line" size="md" className="w-full justify-start gap-1 overflow-x-auto">
          <TabsTrigger
            value="accounts"
            className="gap-1.5 px-3 data-[state=active]:text-foreground"
          >
            Accounts {countChip(accounts.length)}
          </TabsTrigger>
          <TabsTrigger value="models" className="gap-1.5 px-3 data-[state=active]:text-foreground">
            Models {countChip(modelCount)}
          </TabsTrigger>
          <TabsTrigger
            value="playground"
            className="gap-1.5 px-3 data-[state=active]:text-foreground"
          >
            Playground
          </TabsTrigger>
        </TabsList>

        <TabsContent value="accounts" className="mt-5">
          {accountQuery.isLoading || accounts.length > 0 ? (
            <AccountsPanel
              accounts={accounts}
              loading={accountQuery.isLoading}
              canManageKeys
              provider={{ slug, name: provider.name }}
              onAddKey={() => setAccountOpen(true)}
              onChanged={invalidate}
            />
          ) : (
            <EmptyCard
              icon={active.icon}
              title={`No ${provider.name} accounts yet`}
              description="Add an account to start routing requests here."
              action={
                <Button variant="outline" onClick={() => setAccountOpen(true)}>
                  <IconPlus />
                  Add account
                </Button>
              }
            />
          )}
        </TabsContent>

        <TabsContent value="models" className="mt-5">
          <MediaModelsPanel slug={slug} kind={active.label} loading={modelsQuery.isLoading} />
        </TabsContent>

        <TabsContent value="playground" className="mt-5">
          <EmptyCard
            icon={IconMessageChatbot}
            title={`Try ${provider.name} in the playground`}
            description="Send a test request through the gateway with any of this provider's models."
            action={
              <Button asChild variant="outline">
                <Link to="/playground">
                  <IconMessageChatbot />
                  Open playground
                </Link>
              </Button>
            }
          />
        </TabsContent>
      </Tabs>

      <AddCustomProviderApiKeyForm
        open={accountOpen}
        onOpenChange={setAccountOpen}
        provider={{ slug, name: provider.name }}
        onSuccess={() => void invalidate()}
        variant="media"
      />
    </div>
  )
}

function EmptyCard({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: React.ElementType
  title: string
  description: string
  action: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center rounded-lg border border-border bg-card px-6 py-12 text-center">
      <span
        className={`flex size-10 items-center justify-center rounded-lg bg-teal-500/10 ${TEAL}`}
      >
        <Icon className="size-5" aria-hidden />
      </span>
      <p className="mt-3.5 text-sm font-semibold">{title}</p>
      <p className="mt-1 text-[13px] text-muted-foreground">{description}</p>
      <div className="mt-4">{action}</div>
    </div>
  )
}

/** Enabled models from the provider's synced catalog, with the id to route by. */
function MediaModelsPanel({
  slug,
  kind,
  loading,
}: {
  slug: string
  kind: string
  loading: boolean
}) {
  const [filter, setFilter] = useState('')
  const query = filter.trim()
  const { data } = useQuery(
    queries.providers.catalogModels(slug, {
      offset: 0,
      limit: MODEL_LIMIT,
      state: 'active',
      search: query || undefined,
    })
  )
  const sync = useMutation(queries.providers.catalogModelsSync(slug))
  const page = data?.data
  const rows = page?.models ?? []
  const total = page?.total ?? rows.length
  const neverSynced = !query && rows.length === 0 && !page?.fetched_at

  const handleSync = async () => {
    try {
      const result = await sync.mutateAsync()
      toast.success(`Synced ${result.data.models.length} models from upstream`)
    } catch (error) {
      toastAxiosError(error)
    }
  }

  return (
    <SectionCardPanel
      icon={IconCpu}
      title="Models"
      description={`${total} ${total === 1 ? 'model' : 'models'}`}
      toolbar={
        <InputWrapper variant="md" className="w-full rounded-md sm:w-72">
          <IconSearch className="size-4" />
          <Input
            aria-label="Filter models"
            placeholder="Filter models"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </InputWrapper>
      }
    >
      {loading ? (
        <div className="space-y-2 p-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
          <p className="text-[13px] text-muted-foreground">
            {neverSynced
              ? 'No models yet. Sync the list from the provider once an account is added.'
              : query
                ? 'No model matches this filter.'
                : 'No enabled models. Enable some on the provider page.'}
          </p>
          {neverSynced ? (
            <Button
              variant="outline"
              size="sm"
              disabled={sync.isPending}
              onClick={() => void handleSync()}
            >
              <IconRefresh />
              {sync.isPending ? 'Syncing…' : 'Sync models'}
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-[13px]">
            <thead className="border-b border-border text-xs text-muted-foreground dark:bg-muted/40">
              <tr>
                <th className="w-[33%] px-4 py-2 text-left font-medium">Model</th>
                <th className="w-[18%] px-4 py-2 text-left font-medium">Kind</th>
                <th className="px-4 py-2 text-left font-medium">Route as</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.id} className="border-b border-border last:border-0">
                  <td className="max-w-0 px-4 py-2">
                    <code className="block truncate font-mono text-[12.5px]" title={m.id}>
                      {m.id}
                    </code>
                  </td>
                  <td className="px-4 py-2 text-[12.5px] text-muted-foreground">{kind}</td>
                  <td className="px-4 py-2">
                    <RouteAs value={`${slug}/${m.id}`} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {total > rows.length ? (
            <p className="border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
              Showing {rows.length} of {total}. Filter to find the rest.
            </p>
          ) : null}
        </div>
      )}
    </SectionCardPanel>
  )
}

/** The routable id, copied on click. */
function RouteAs({ value }: { value: string }) {
  const { copied, copy } = useCopyToClipboard()
  return (
    <button
      type="button"
      onClick={() => copy(value)}
      className="inline-flex max-w-full items-center gap-1.5 rounded-sm font-mono text-xs text-muted-foreground hover:text-foreground"
      aria-label={`Copy ${value}`}
    >
      <span className="truncate">{value}</span>
      {copied ? (
        <IconCheck className="size-3.5 shrink-0 text-emerald-500" aria-hidden />
      ) : (
        <IconCopy className="size-3.5 shrink-0" aria-hidden />
      )}
    </button>
  )
}
