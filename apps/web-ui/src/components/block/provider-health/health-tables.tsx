import { IconActivity, IconChevronRight } from '@tabler/icons-react'
import { Link } from '@tanstack/react-router'

import type { HealthEntry, HealthStatus } from '@/lib/api/models/provider-health'

import TablePagination, { usePagedRows } from '@/components/block/common/table-pagination'
import { HealthTimeline } from '@/components/block/dashboard/overview-provider-health'
import { getProviderBrand, ProviderAvatar } from '@/components/block/providers/provider-avatar'
import { formatCount, formatMs } from '@/lib/format'
import { cn } from '@/lib/utils'

const PAGE_SIZE = 10

export const STATUS_META: Record<HealthStatus, { label: string; pill: string; text: string }> = {
  healthy: {
    label: 'Healthy',
    pill: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    text: '',
  },
  degraded: {
    label: 'Degraded',
    pill: 'border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400',
    text: 'text-amber-600 dark:text-amber-400',
  },
  down: {
    label: 'Unhealthy',
    pill: 'border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400',
    text: 'text-red-600 dark:text-red-400',
  },
}

/** What a failure kind means for the operator, and what to try. */
const ISSUES: Record<string, { label: string; advice: string }> = {
  auth: {
    label: 'Auth error',
    advice: 'Re-check the API key or OAuth connection for this provider account.',
  },
  rate_limit: {
    label: 'Rate limited',
    advice: 'Lower the request rate or add another account to spread the load.',
  },
  quota_exhausted: {
    label: 'Quota exhausted',
    advice: 'Wait for the quota to reset or add another account.',
  },
  account_suspended: {
    label: 'Account suspended',
    advice: "Check the account's balance or plan with the provider.",
  },
  billing: { label: 'Billing problem', advice: "Check the account's balance or plan." },
  upstream: {
    label: 'Upstream errors',
    advice: 'The provider returned server errors. Check its status page.',
  },
  upstream_blocked: {
    label: 'Blocked upstream',
    advice: "The provider's edge rejected requests. Try another network or region.",
  },
  timeout: { label: 'Timeouts', advice: 'Requests timed out. Check latency or raise the timeout.' },
  capacity: {
    label: 'At capacity',
    advice: 'The provider is overloaded. Retry later or fall back.',
  },
  model_not_found: {
    label: 'Model not found',
    advice: 'Sync the model list or remove the model from routing.',
  },
  bad_request: { label: 'Bad requests', advice: 'Clients sent requests the provider rejected.' },
  context_too_large: {
    label: 'Context too large',
    advice: "Prompts exceed the model's context window.",
  },
}

/** Label and advice for an entry's main issue; null when nothing failed. */
export function issueOf(entry: HealthEntry) {
  if (!entry.mainIssue) {
    return entry.finalFailures + entry.fallbacks > 0 ? { label: 'Errors', advice: '' } : null
  }
  return (
    ISSUES[entry.mainIssue] ?? {
      label: entry.mainIssue.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()),
      advice: '',
    }
  )
}

export function StatusPill({ status }: { status: HealthStatus }) {
  const meta = STATUS_META[status]
  return (
    <span
      className={cn(
        'inline-flex h-5 items-center rounded-sm border px-[7px] text-[11.5px] font-medium',
        meta.pill
      )}
    >
      {meta.label}
    </span>
  )
}

const TH = 'px-4 py-2 text-left font-medium'
const THEAD = 'border-b border-border text-xs text-muted-foreground dark:bg-muted/40'
const ROW = 'border-b border-border last:border-0'

function Panel({
  entries,
  empty,
  children,
}: {
  entries: unknown[]
  empty: string
  children: React.ReactNode
}) {
  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-lg border border-border bg-card px-6 py-9 text-center">
        <span className="flex size-10 items-center justify-center rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400">
          <IconActivity className="size-5" aria-hidden />
        </span>
        <p className="mt-2.5 text-[13px] font-semibold">{empty}</p>
        <p className="mt-1 text-[12.5px] text-muted-foreground">
          Rows appear once traffic flows through the gateway.
        </p>
      </div>
    )
  }
  return <div className="overflow-hidden rounded-lg border border-border bg-card">{children}</div>
}

function Pager({
  paged,
  total,
}: {
  paged: ReturnType<typeof usePagedRows<unknown>>
  total: number
}) {
  return paged.pageCount > 1 ? (
    <TablePagination
      page={paged.page}
      pageCount={paged.pageCount}
      pageSize={PAGE_SIZE}
      total={total}
      onPageChange={paged.setPage}
    />
  ) : null
}

function ProviderMark({ slug }: { slug: string }) {
  if (getProviderBrand(slug).icon) {
    return <ProviderAvatar slug={slug} size="sm" className="size-[22px] rounded-sm" />
  }
  return (
    <span className="flex size-[22px] shrink-0 items-center justify-center rounded-sm border border-border bg-muted font-mono text-[9px] font-medium text-muted-foreground uppercase">
      {slug.slice(0, 2)}
    </span>
  )
}

export function ProvidersHealthTable({
  entries,
  span,
  accounts,
  onOpen,
}: {
  entries: HealthEntry[]
  span: string
  /** account count per provider slug */
  accounts: Map<string, number>
  onOpen: (slug: string) => void
}) {
  const paged = usePagedRows(entries, PAGE_SIZE)
  return (
    <Panel entries={entries} empty="No provider traffic in this range">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[64rem] text-[13px]">
          <thead className={THEAD}>
            <tr>
              <th className={cn(TH, 'w-[30%]')}>Provider</th>
              <th className={TH}>Status</th>
              <th className={cn(TH, 'w-44')}>Uptime · {span}</th>
              <th className={TH}>Requests</th>
              <th className={TH}>Success</th>
              <th className={TH}>p95</th>
              <th className={cn(TH, 'w-[22%]')}>Main issue</th>
            </tr>
          </thead>
          <tbody>
            {paged.rows.map((e) => {
              const n = accounts.get(e.id) ?? 0
              const issue = issueOf(e)
              return (
                <tr key={e.id} className={ROW}>
                  <td className="max-w-0 px-4 py-2.5">
                    <button
                      type="button"
                      onClick={() => onOpen(e.id)}
                      className="flex w-full min-w-0 items-center gap-2.5 rounded-sm text-left"
                    >
                      <ProviderMark slug={e.id} />
                      <span className="min-w-0">
                        <span className="block truncate font-medium hover:underline">{e.name}</span>
                        <span className="block truncate font-mono text-[11.5px] text-muted-foreground">
                          {e.id} · {n} {n === 1 ? 'account' : 'accounts'}
                        </span>
                      </span>
                    </button>
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusPill status={e.status} />
                  </td>
                  <td className="px-4 py-2.5">
                    <HealthTimeline entry={e} span={span} className="w-40 gap-0.5" />
                  </td>
                  <td className="px-4 py-2.5 tabular-nums">{formatCount(e.requests)}</td>
                  <td className={cn('px-4 py-2.5 tabular-nums', STATUS_META[e.status].text)}>
                    {e.requests ? `${e.successRate.toFixed(1)}%` : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground tabular-nums">
                    {e.p95Ms ? formatMs(e.p95Ms) : '—'}
                  </td>
                  <td className="px-4 py-2.5">
                    {issue ? (
                      <>
                        <span className="block">{issue.label}</span>
                        {issue.advice ? (
                          <span className="block text-xs text-muted-foreground">
                            {issue.advice}
                          </span>
                        ) : null}
                      </>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <Pager paged={paged} total={entries.length} />
    </Panel>
  )
}

/** 0–100: success rate, discounted by how often another target had to step in. */
const scoreOf = (e: HealthEntry) => Math.round(e.successRate * (1 - e.fallbackRate / 100))

export function ModelsHealthTable({ entries }: { entries: HealthEntry[] }) {
  const paged = usePagedRows(entries, PAGE_SIZE)
  return (
    <Panel entries={entries} empty="No model traffic in this range">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[60rem] text-[13px]">
          <thead className={THEAD}>
            <tr>
              <th className={cn(TH, 'w-[37%]')}>Model</th>
              <th className={TH}>Status</th>
              <th className={TH}>Score</th>
              <th className={TH}>Success</th>
              <th className={TH}>p95</th>
              <th className={TH}>Fallbacks</th>
              <th className={TH}>Main issue</th>
            </tr>
          </thead>
          <tbody>
            {paged.rows.map((e) => {
              const slash = e.name.indexOf('/')
              const score = scoreOf(e)
              const tone = STATUS_META[e.status]
              return (
                <tr key={e.id} className={ROW}>
                  <td className="max-w-0 px-4 py-2.5">
                    <span className="block truncate font-mono text-[12.5px]" title={e.name}>
                      <span className="text-muted-foreground">{e.name.slice(0, slash + 1)}</span>
                      {e.name.slice(slash + 1)}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusPill status={e.status} />
                  </td>
                  <td className="px-4 py-2.5">
                    {e.requests ? (
                      <span className="flex items-center gap-2">
                        <span className={cn('w-7 font-medium tabular-nums', tone.text)}>
                          {score}
                        </span>
                        <span
                          className="h-1.5 w-12 overflow-hidden rounded-full bg-muted"
                          aria-hidden
                        >
                          <span
                            className={cn(
                              'block h-full',
                              e.status === 'healthy'
                                ? 'bg-emerald-500'
                                : e.status === 'degraded'
                                  ? 'bg-amber-500'
                                  : 'bg-red-500'
                            )}
                            style={{ width: `${score}%` }}
                          />
                        </span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 tabular-nums">
                    {e.requests ? `${e.successRate.toFixed(1)}%` : '—'}
                  </td>
                  <td className="px-4 py-2.5 tabular-nums">{e.p95Ms ? formatMs(e.p95Ms) : '—'}</td>
                  <td className="px-4 py-2.5 text-muted-foreground tabular-nums">
                    {formatCount(e.fallbacks)}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{issueOf(e)?.label ?? '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <Pager paged={paged} total={entries.length} />
    </Panel>
  )
}

export function ChainsHealthTable({
  entries,
  chainIds,
}: {
  entries: HealthEntry[]
  /** chain id per name, for the detail link */
  chainIds: Map<string, string>
}) {
  const paged = usePagedRows(entries, PAGE_SIZE)
  return (
    <Panel entries={entries} empty="No chains yet">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[52rem] text-[13px]">
          <thead className={THEAD}>
            <tr>
              <th className={cn(TH, 'w-[23%]')}>Chain</th>
              <th className={TH}>Status</th>
              <th className={TH}>Requests</th>
              <th className={TH}>Fallback rate</th>
              <th className={TH}>Final failures</th>
              <th className={TH}>Most affected</th>
              <th className="w-12 px-2 py-2">
                <span className="sr-only">Open</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {paged.rows.map((e) => {
              const id = chainIds.get(e.name)
              return (
                <tr key={e.id} className={ROW}>
                  <td className="max-w-0 px-4 py-2.5">
                    <span className="block truncate font-medium" title={e.name}>
                      {e.name}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusPill status={e.status} />
                  </td>
                  <td className="px-4 py-2.5 tabular-nums">{formatCount(e.requests)}</td>
                  <td className="px-4 py-2.5 tabular-nums">{e.fallbackRate.toFixed(1)}%</td>
                  <td className="px-4 py-2.5 text-muted-foreground tabular-nums">
                    {formatCount(e.finalFailures)}
                  </td>
                  <td className="max-w-0 px-4 py-2.5">
                    {e.mostAffected ? (
                      <code className="block truncate font-mono text-xs" title={e.mostAffected}>
                        {e.mostAffected}
                      </code>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-2 py-2.5 text-right">
                    {id ? (
                      <Link
                        to="/chains/$chainId"
                        params={{ chainId: id }}
                        aria-label={`Open chain ${e.name}`}
                        className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        <IconChevronRight className="size-4" />
                      </Link>
                    ) : null}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <Pager paged={paged} total={entries.length} />
    </Panel>
  )
}
