import {
  IconActivity,
  IconAlertTriangle,
  IconArrowsShuffle,
  IconClock,
  IconHeartbeat,
  IconRefresh,
} from '@tabler/icons-react'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useQueryState } from 'nuqs'
import { useMemo, useState } from 'react'

import type { HealthStatus, HealthWindow } from '@/lib/api/models/provider-health'

import PageHeader from '@/components/block/common/page-header'
import SegmentedControl from '@/components/block/common/segmented-control'
import { Stat } from '@/components/block/provider-detail/provider-stat-strip'
import {
  ChainsHealthTable,
  HEALTH_PAGE_SIZES,
  ModelsHealthTable,
  ProbesHealthTable,
  ProvidersHealthTable,
} from '@/components/block/provider-health/health-tables'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useOpenProvider } from '@/hooks/use-open-provider'
import { usePaginationQuery } from '@/hooks/use-pagination-query'
import { queries } from '@/lib/api/queries'
import { PROVIDER_HEALTH_QUERY_KEY } from '@/lib/api/queries/provider-health'
import { formatCount, formatMs } from '@/lib/format'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/(protected)/(safety)/provider-health/')({
  component: RouteComponent,
})

type Range = 'live' | '1h' | '6h' | '24h' | '7d' | '30d'

const RANGES: { value: Range; label: string }[] = [
  { value: 'live', label: 'Live' },
  { value: '1h', label: '1h' },
  { value: '6h', label: '6h' },
  { value: '24h', label: '24h' },
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
]

/** Live watches the last 15 minutes and refreshes on its own. */
const LIVE_WINDOW: HealthWindow = '15m'
const LIVE_REFRESH_MS = 10_000

const TABS = ['providers', 'models', 'chains', 'probes'] as const
type Tab = (typeof TABS)[number]

const STATUS_FILTERS: { value: HealthStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'healthy', label: 'Healthy' },
  { value: 'degraded', label: 'Degraded' },
  { value: 'down', label: 'Unhealthy' },
]

const TEAL = 'bg-teal-500/10 text-teal-600 dark:text-teal-400'

function RouteComponent() {
  const queryClient = useQueryClient()
  const [range, setRange] = useState<Range>('24h')
  const [tab, setTab] = useState<Tab>('providers')
  const [status, setStatus] = useState<HealthStatus | 'all'>('all')
  // Each tab's table pages on its own, so a page from another tab or from
  // before a status filter is dropped.
  const [, setPage] = useQueryState('page')
  const [, setPageSize] = useQueryState('pageSize')
  const resetPaging = () => {
    void setPage(null)
    void setPageSize(null)
  }

  const live = range === 'live'
  const healthWindow = live ? LIVE_WINDOW : range
  const span = live ? '15m' : range
  // The server returns the open tab's rows, narrowed by status and cut to a
  // page, plus the counts over every row for the badges and the summary.
  const { offset, limit } = usePaginationQuery({ defaultLimit: HEALTH_PAGE_SIZES[0] })
  const filterable = tab === 'providers' || tab === 'models'
  const { data, isFetching } = useQuery({
    ...queries.providerHealth.overview(healthWindow, {
      tab,
      status: filterable && status !== 'all' ? status : undefined,
      offset,
      limit,
    }),
    refetchInterval: live ? LIVE_REFRESH_MS : false,
    placeholderData: keepPreviousData,
  })
  const chainsQuery = useQuery(queries.chains.list())
  const openProvider = useOpenProvider()

  const chainIds = useMemo(
    () => new Map((chainsQuery.data?.data ?? []).map((c) => [c.name, c.id])),
    [chainsQuery.data]
  )

  const counts = data?.counts
  const down = counts?.down ?? 0
  const degraded = counts?.degraded ?? 0
  const healthy = counts?.healthy ?? 0
  const providerCount = counts?.providers ?? 0
  const total = data?.total ?? 0

  const figure = (value: string) => (
    <span className="text-xl font-semibold tabular-nums">{value}</span>
  )
  const note = (text: string) => <span className="block text-xs text-muted-foreground">{text}</span>
  const tabCount = (t: Tab) => counts?.[t] ?? 0

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={IconActivity}
        title="Provider health"
        description="Which upstreams are failing or slow, and what to do."
        actions={
          <>
            <SegmentedControl
              aria-label="Time range"
              options={RANGES}
              value={range}
              onChange={setRange}
            />
            <Button
              variant="outline"
              size="icon"
              aria-label="Refresh"
              disabled={isFetching}
              onClick={() =>
                void queryClient.invalidateQueries({ queryKey: [PROVIDER_HEALTH_QUERY_KEY] })
              }
            >
              <IconRefresh className={cn(isFetching && 'motion-safe:animate-spin')} />
            </Button>
          </>
        }
      />

      {data ? (
        <dl className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            icon={IconAlertTriangle}
            label="Unhealthy"
            iconClassName="bg-red-500/10 text-red-600 dark:text-red-400"
          >
            {figure(formatCount(down))}
            {note(`of ${providerCount} ${providerCount === 1 ? 'provider' : 'providers'}`)}
          </Stat>
          <Stat
            icon={IconHeartbeat}
            label="Degraded"
            iconClassName="bg-amber-500/10 text-amber-600 dark:text-amber-400"
          >
            {figure(formatCount(degraded))}
            {note(`${healthy} healthy`)}
          </Stat>
          <Stat icon={IconArrowsShuffle} label="Fallbacks" iconClassName={TEAL}>
            {figure(formatCount(data.fallbacks))}
            {note(
              `of ${formatCount(data.requests)} ${data.requests === 1 ? 'request' : 'requests'}`
            )}
          </Stat>
          <Stat icon={IconClock} label="Avg p95 latency" iconClassName={TEAL}>
            {figure(data.avgP95Ms ? formatMs(data.avgP95Ms) : '—')}
          </Stat>
        </dl>
      ) : (
        <Skeleton className="h-[99px] rounded-lg" />
      )}

      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border">
          <div role="tablist" aria-label="Health view" className="flex gap-1">
            {TABS.map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={tab === t}
                onClick={() => {
                  setTab(t)
                  resetPaging()
                }}
                className={cn(
                  '-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-[13px] font-medium capitalize transition-colors',
                  tab === t
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                )}
              >
                {t}
                {data ? (
                  <span className="rounded-sm bg-muted px-1.5 text-[11.5px] text-muted-foreground tabular-nums">
                    {tabCount(t)}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
          {tab === 'providers' || tab === 'models' ? (
            <div role="group" aria-label="Status" className="flex gap-1 pb-2">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  aria-pressed={status === f.value}
                  onClick={() => {
                    setStatus(f.value)
                    void setPage(null)
                  }}
                  className={cn(
                    'inline-flex h-7 items-center rounded-md border px-2.5 text-xs font-medium transition-colors',
                    status === f.value
                      ? 'border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400'
                      : 'border-border bg-card text-muted-foreground hover:text-foreground'
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {!data ? (
          <Skeleton className="h-40 rounded-lg" />
        ) : tab === 'providers' ? (
          <ProvidersHealthTable
            key={`p-${status}`}
            entries={data.providers}
            total={total}
            span={span}
            onOpen={openProvider}
          />
        ) : tab === 'models' ? (
          <ModelsHealthTable key={`m-${status}`} entries={data.models} total={total} />
        ) : tab === 'chains' ? (
          <ChainsHealthTable entries={data.chains} total={total} chainIds={chainIds} />
        ) : (
          <ProbesHealthTable entries={data.probes} />
        )}
      </div>
    </div>
  )
}
