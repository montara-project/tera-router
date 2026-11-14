import {
  IconChartBar,
  IconCalendarMonth,
  IconCoin,
  IconKey,
  IconLink,
  IconLinkOff,
  IconStack2,
} from '@tabler/icons-react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { isAxiosError } from 'axios'
import { useQueryState } from 'nuqs'
import { useEffect, useState } from 'react'

import BrandLogo from '@/components/block/common/brand-logo'
import PortalDailyChart from '@/components/block/portal/portal-daily-chart'
import {
  PORTAL_PAGE_SIZES,
  PortalLimits,
  PortalModels,
  PortalRecent,
} from '@/components/block/portal/portal-panels'
import { Stat } from '@/components/block/provider-detail/provider-stat-strip'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useBranding } from '@/hooks/use-branding'
import { usePaginationQuery } from '@/hooks/use-pagination-query'
import { queries } from '@/lib/api/queries'
import { formatMicrosUsd } from '@/lib/currency'
import { formatTimeAgo } from '@/lib/date'
import { formatCompact, formatCount } from '@/lib/format'
import { cn } from '@/lib/utils'

/** Remembers the last opened link so a returning visitor lands on their usage. */
const STORAGE_KEY = 'tera-router.portal-token'
const RANGES = [7, 14, 30, 90] as const

export const Route = createFileRoute('/portal')({
  validateSearch: (search: Record<string, unknown>): { id?: string } => ({
    id: typeof search.id === 'string' && search.id ? search.id : undefined,
  }),
  component: PortalRoute,
})

const storage = {
  get: () => {
    try {
      return localStorage.getItem(STORAGE_KEY) ?? ''
    } catch {
      return ''
    }
  },
  set: (token: string) => {
    try {
      localStorage.setItem(STORAGE_KEY, token)
    } catch {
      // Private mode: the link still works, it just is not remembered.
    }
  },
  clear: () => {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // nothing stored
    }
  },
}

/** Accepts a pasted portal URL or a bare token. */
function tokenFrom(value: string) {
  const text = value.trim()
  try {
    return new URL(text).searchParams.get('id') ?? ''
  } catch {
    return text
  }
}

function PortalRoute() {
  const { id } = Route.useSearch()
  const navigate = useNavigate()
  const remembered = id ? '' : storage.get()
  const [updatedAt, setUpdatedAt] = useState(0)

  useEffect(() => {
    if (id) storage.set(id)
    else if (remembered) void navigate({ to: '/portal', search: { id: remembered }, replace: true })
  }, [id, remembered, navigate])

  const forget = () => {
    storage.clear()
    void navigate({ to: '/portal', search: {} })
  }

  return (
    <div className="min-h-svh bg-background">
      <PortalHeader token={id} updatedAt={updatedAt} onForget={forget} />
      {id ? (
        <PortalUsageView token={id} onForget={forget} onUpdated={setUpdatedAt} />
      ) : remembered ? null : (
        <OpenLink />
      )}
    </div>
  )
}

function PortalHeader({
  token,
  updatedAt,
  onForget,
}: {
  token?: string
  updatedAt: number
  onForget: () => void
}) {
  const branding = useBranding()
  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex min-h-14 max-w-[1200px] flex-wrap items-center gap-3 px-4 py-2 sm:px-6">
        <span className="flex items-center gap-2">
          <BrandLogo />
          <span className="text-sm font-semibold">{branding.name}</span>
        </span>
        <span className="h-4 w-px bg-border" aria-hidden />
        <span className="text-[13px] text-muted-foreground">Usage portal</span>
        {token ? (
          <div className="ml-auto flex min-w-0 flex-wrap items-center gap-2">
            <span className="flex h-8 min-w-0 items-stretch overflow-hidden rounded-md border border-border text-xs">
              <span className="flex shrink-0 items-center gap-1.5 border-r border-border bg-muted/40 px-2.5 text-muted-foreground">
                <IconLink className="size-3.5" aria-hidden />
                Shared link
              </span>
              <code
                className="flex min-w-0 items-center truncate px-2.5 font-mono text-muted-foreground"
                title={token}
              >
                {token}
              </code>
            </span>
            <UpdatedAgo at={updatedAt} />
            <Button variant="outline" size="sm" onClick={onForget}>
              <IconLinkOff />
              Forget link
            </Button>
          </div>
        ) : null}
      </div>
    </header>
  )
}

/** "Updated 15s ago", ticking while the page is open. */
function UpdatedAgo({ at }: { at: number }) {
  const [, tick] = useState(0)
  useEffect(() => {
    const timer = window.setInterval(() => tick((n) => n + 1), 15_000)
    return () => window.clearInterval(timer)
  }, [])
  if (!at) return null
  return (
    <span className="hidden h-8 items-center rounded-md border border-border px-2.5 text-xs font-medium text-muted-foreground sm:flex">
      Updated {formatTimeAgo(at)}
    </span>
  )
}

function OpenLink() {
  const navigate = useNavigate()
  const [value, setValue] = useState('')
  const token = tokenFrom(value)

  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-20">
      <span className="flex size-10 items-center justify-center rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400">
        <IconKey className="size-5" aria-hidden />
      </span>
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">Open your usage portal</h1>
        <p className="text-[13px] text-muted-foreground">
          Paste the portal link your admin sent you. It shows one API key&apos;s usage.
        </p>
      </div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (token) void navigate({ to: '/portal', search: { id: token } })
        }}
      >
        <Input
          aria-label="Portal link"
          placeholder="https://…/portal?id=pt_…"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="flex-1 font-mono text-[12.5px]"
          autoComplete="off"
        />
        <Button type="submit" disabled={!token}>
          Open
        </Button>
      </form>
    </main>
  )
}

function PortalUsageView({
  token,
  onForget,
  onUpdated,
}: {
  token: string
  onForget: () => void
  onUpdated: (at: number) => void
}) {
  const [days, setDays] = useState<(typeof RANGES)[number]>(30)
  // The server pages the request log; the pager keeps its page in ?page.
  const { offset, limit } = usePaginationQuery({ defaultLimit: PORTAL_PAGE_SIZES[0] })
  const [, setPage] = useQueryState('page')
  const query = useQuery({
    ...queries.portal.get(token, days, { offset, limit }),
    placeholderData: keepPreviousData,
  })
  const data = query.data

  useEffect(() => {
    onUpdated(query.dataUpdatedAt)
  }, [query.dataUpdatedAt, onUpdated])

  if (query.isError && !data) {
    const gone = isAxiosError(query.error) && query.error.response?.status === 404
    return (
      <main className="mx-auto flex max-w-md flex-col gap-3 px-4 py-20">
        <h1 className="text-xl font-semibold tracking-tight">
          {gone ? 'This link no longer works' : 'Could not load usage'}
        </h1>
        <p className="text-[13px] text-muted-foreground">
          {gone
            ? 'The admin replaced or turned off this portal link. Ask them for a new one.'
            : 'Check your connection and try again.'}
        </p>
        <div className="flex gap-2">
          {gone ? (
            <Button variant="outline" onClick={onForget}>
              Forget link
            </Button>
          ) : (
            <Button onClick={() => void query.refetch()}>Try again</Button>
          )}
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto flex max-w-[1200px] flex-col gap-6 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3.5">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400">
            <IconKey className="size-5" aria-hidden />
          </span>
          {data ? (
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-[22px] font-semibold tracking-tight">
                  {data.key.name}
                </h1>
                {data.key.status === 'disabled' ? (
                  <span className="rounded-sm border border-border bg-muted/40 px-1.5 py-0.5 text-[11.5px] font-medium text-muted-foreground">
                    Disabled
                  </span>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">
                <code className="font-mono">{data.key.key_preview}</code> · {data.key.plan_label}
              </p>
            </div>
          ) : (
            <Skeleton className="h-7 w-40" />
          )}
        </div>
        <div
          role="group"
          aria-label="Period"
          className="inline-flex items-center gap-0.5 rounded-md border border-border bg-muted/40 p-[3px]"
        >
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={days === r}
              onClick={() => {
                // Another range has its own request log: start from its first page.
                setDays(r)
                void setPage(null)
              }}
              className={cn(
                'inline-flex h-[26px] items-center rounded-sm px-2.5 font-mono text-xs font-medium transition-colors',
                days === r
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {r}d
            </button>
          ))}
        </div>
      </div>

      {data ? (
        <>
          <dl className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
            <Stat icon={IconChartBar} label="Requests">
              <span className="text-xl font-semibold tabular-nums">
                {formatCount(data.summary.requests)}
              </span>
            </Stat>
            <Stat icon={IconCoin} label="Spend">
              <span className="text-xl font-semibold tabular-nums">
                {formatMicrosUsd(data.summary.cost_micros)}
              </span>
            </Stat>
            <Stat icon={IconStack2} label="Tokens">
              <span className="text-xl font-semibold tabular-nums">
                {formatCompact(data.summary.prompt_tokens + data.summary.completion_tokens)}
              </span>
              <span className="block text-xs text-muted-foreground tabular-nums">
                {formatCompact(data.summary.prompt_tokens)} in ·{' '}
                {formatCompact(data.summary.completion_tokens)} out
              </span>
            </Stat>
            <Stat icon={IconCalendarMonth} label="This month">
              <span className="text-xl font-semibold tabular-nums">
                {formatMicrosUsd(data.month.cost_micros)}
              </span>
              <span className="block text-xs text-muted-foreground tabular-nums">
                {formatCount(data.month.requests)}{' '}
                {data.month.requests === 1 ? 'request' : 'requests'}
              </span>
            </Stat>
          </dl>

          <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
            <PortalDailyChart daily={data.daily} days={data.days} />
            <PortalLimits limits={data.limits} allowedModels={data.allowed_models} />
          </div>

          <PortalModels models={data.models} />
          <PortalRecent recent={data.recent} total={data.recent_total} />
        </>
      ) : (
        <div className="flex flex-col gap-6">
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-80 w-full rounded-lg" />
          <Skeleton className="h-48 w-full rounded-lg" />
        </div>
      )}
    </main>
  )
}
