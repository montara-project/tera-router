import { IconChevronRight, IconListDetails, IconSearch } from '@tabler/icons-react'
import { format } from 'date-fns'
import { Fragment, useState } from 'react'

import type { Models } from '@/lib/api/models'

import EmptyState from '@/components/block/common/empty-state'
import TablePagination from '@/components/block/common/table-pagination'
import DashboardPanel from '@/components/block/dashboard/dashboard-panel'
import { Button } from '@/components/ui/button'
import { Input, InputWrapper } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

export type AuditFilters = {
  search: string
  outcome: 'all' | Models.AuditOutcome
  category: string
}

export const DEFAULT_AUDIT_FILTERS: AuditFilters = { search: '', outcome: 'all', category: 'all' }

const COLUMNS = 7

/** The part of an action before its first dot: "keys.delete" → "keys". */
const categoryOf = (action: string) => action.split('.')[0] ?? action

/** Who did it, in the table: the dashboard session, an API key or the server. */
function actorLabel(e: Models.AuditEntry) {
  if (e.actor === 'system') return 'System'
  if (e.actor.startsWith('key:')) return `API key · ${e.actor.slice(4)}`
  if (e.session_id) return `Dashboard · ${e.session_id.replaceAll('-', '').slice(0, 12)}`
  return e.actor ? 'Dashboard' : 'Anonymous'
}

/** Who did it, in full, for the detail row. */
function actorDetail(e: Models.AuditEntry) {
  if (e.session_id) return `dashboard session:${e.session_id}`
  if (e.actor === 'system') return 'system'
  if (e.actor.startsWith('key:')) return `api key:${e.actor.slice(4)}`
  return e.actor ? `user:${e.actor}` : 'not signed in'
}

function resourceOf(e: Models.AuditEntry) {
  const category = categoryOf(e.action)
  return e.target && e.target !== category ? `${category}/${e.target}` : category
}

function OutcomeBadge({ outcome }: { outcome: Models.AuditOutcome }) {
  const failed = outcome === 'failed'
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-sm px-1.5 py-0.5 text-[11.5px] font-medium whitespace-nowrap ring-1 ring-inset',
        failed
          ? 'bg-destructive/10 text-red-700 ring-destructive/25 dark:text-red-400'
          : 'bg-emerald-500/10 text-emerald-700 ring-emerald-500/25 dark:text-emerald-400'
      )}
    >
      {failed ? 'Failed' : 'Success'}
    </span>
  )
}

interface AuditEventsProps {
  rows: Models.AuditEntry[]
  total: number
  loading: boolean
  error: boolean
  onRetry: () => void
  categories: string[]
  filters: AuditFilters
  onFiltersChange: (patch: Partial<AuditFilters>) => void
  page: number
  pageSize: number
  onPageChange: (page: number) => void
}

export default function AuditEvents({
  rows,
  total,
  loading,
  error,
  onRetry,
  categories,
  filters,
  onFiltersChange,
  page,
  pageSize,
  onPageChange,
}: AuditEventsProps) {
  const [open, setOpen] = useState<Set<string>>(new Set())
  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const filtered =
    filters.search.trim() !== '' || filters.outcome !== 'all' || filters.category !== 'all'

  return (
    <DashboardPanel
      icon={IconListDetails}
      title="Events"
      toolbar={
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <InputWrapper className="w-full sm:w-72">
            <IconSearch aria-hidden />
            <Input
              type="search"
              aria-label="Search action, resource, actor, IP"
              placeholder="Search action, resource, actor, IP"
              value={filters.search}
              onChange={(event) => onFiltersChange({ search: event.target.value })}
            />
          </InputWrapper>
          <Select
            value={filters.outcome}
            onValueChange={(outcome) =>
              onFiltersChange({ outcome: outcome as AuditFilters['outcome'] })
            }
          >
            <SelectTrigger className="w-full sm:w-40" aria-label="Outcome">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All outcomes</SelectItem>
              <SelectItem value="success">Success</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={filters.category}
            onValueChange={(category) => onFiltersChange({ category })}
          >
            <SelectTrigger className="w-full sm:w-36" aria-label="Action">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actions</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      }
    >
      {error ? (
        <EmptyState
          icon={IconListDetails}
          title="Couldn't load the audit log"
          description="The server did not answer. Check that it is running, then try again."
          action={
            <Button variant="outline" onClick={onRetry}>
              Try again
            </Button>
          }
          className="py-10"
        />
      ) : !loading && rows.length === 0 ? (
        <EmptyState
          icon={IconListDetails}
          title={filtered ? 'No events match' : 'No events yet'}
          description={
            filtered
              ? 'Try a different search, outcome or action.'
              : 'Sign-ins and configuration changes show up here as they happen.'
          }
          action={
            filtered && (
              <Button variant="outline" onClick={() => onFiltersChange(DEFAULT_AUDIT_FILTERS)}>
                Clear filters
              </Button>
            )
          }
          className="py-10"
        />
      ) : (
        <>
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[60rem] text-[13px]">
              <thead className="border-b border-border text-xs text-muted-foreground dark:bg-muted/40">
                <tr>
                  <th className="w-10">
                    <span className="sr-only">Details</span>
                  </th>
                  <th className="w-[13rem] px-3 py-2 text-left font-medium">Time</th>
                  <th className="px-3 py-2 text-left font-medium">Action</th>
                  <th className="px-3 py-2 text-left font-medium">Actor</th>
                  <th className="px-3 py-2 text-left font-medium">Resource</th>
                  <th className="px-3 py-2 text-left font-medium">Outcome</th>
                  <th className="px-3 py-2 text-left font-medium">Client</th>
                </tr>
              </thead>
              <tbody>
                {loading
                  ? Array.from({ length: 6 }, (_, i) => (
                      <tr key={i} className="border-b border-border last:border-0">
                        <td colSpan={COLUMNS} className="px-4 py-2.5">
                          <Skeleton className="h-6 w-full" />
                        </td>
                      </tr>
                    ))
                  : rows.map((row) => (
                      <AuditRow
                        key={row.id}
                        row={row}
                        expanded={open.has(row.id)}
                        onToggle={() => toggle(row.id)}
                      />
                    ))}
              </tbody>
            </table>
          </div>
          <TablePagination
            page={page}
            pageCount={Math.max(Math.ceil(total / pageSize), 1)}
            pageSize={pageSize}
            total={total}
            onPageChange={onPageChange}
          />
        </>
      )}
    </DashboardPanel>
  )
}

function AuditRow({
  row,
  expanded,
  onToggle,
}: {
  row: Models.AuditEntry
  expanded: boolean
  onToggle: () => void
}) {
  const detailId = `audit-detail-${row.id}`

  return (
    <Fragment>
      <tr className={cn('border-b border-border last:border-0', expanded && 'bg-muted/50')}>
        <td className="py-1.5 pl-2 align-middle">
          <Button
            variant="ghost"
            mode="icon"
            size="sm"
            aria-expanded={expanded}
            aria-controls={expanded ? detailId : undefined}
            aria-label={`${expanded ? 'Hide' : 'Show'} details for ${row.action}`}
            onClick={onToggle}
          >
            <IconChevronRight
              className={cn(
                'size-4 motion-safe:transition-[rotate] motion-safe:duration-150',
                expanded && 'rotate-90'
              )}
              aria-hidden
            />
          </Button>
        </td>
        <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground tabular-nums">
          <time dateTime={row.created_at}>
            {format(new Date(row.created_at), 'MMM d, yyyy, HH:mm:ss')}
          </time>
        </td>
        <td className="px-3 py-2.5 font-mono text-xs text-foreground">{row.action}</td>
        <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">{actorLabel(row)}</td>
        <td className="px-3 py-2.5 font-mono text-xs break-all text-muted-foreground">
          {resourceOf(row)}
        </td>
        <td className="px-3 py-2.5">
          <OutcomeBadge outcome={row.outcome} />
        </td>
        <td className="px-3 py-2.5 font-mono text-xs whitespace-nowrap text-muted-foreground">
          {row.client_ip || '—'}
        </td>
      </tr>
      {expanded && (
        <tr id={detailId} className="border-b border-border bg-muted/50 last:border-0">
          {/* Indented past the toggle column so labels line up with Time. */}
          <td colSpan={COLUMNS} className="pt-1 pr-3 pb-4 pl-[3.25rem]">
            <AuditDetail row={row} />
          </td>
        </tr>
      )}
    </Fragment>
  )
}

function AuditDetail({ row }: { row: Models.AuditEntry }) {
  const items: [string, string][] = [
    ['Request', row.method ? `${row.method} ${row.route} → ${row.status}` : '—'],
    ['Actor', actorDetail(row)],
    ['Forwarded for', row.forwarded_for || '—'],
    ['User agent', row.user_agent || '—'],
    ['Request ID', row.request_id || '—'],
    ['Chain', row.seq === null ? 'Not chained (written before the chain existed)' : `#${row.seq}`],
    ['Hash', row.hash || '—'],
  ]
  if (row.detail && row.detail !== '{}') items.push(['Details', row.detail])

  return (
    <dl className="grid gap-x-6 gap-y-1.5 sm:grid-cols-[10rem_1fr]">
      {items.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-[12.5px] text-muted-foreground">{label}</dt>
          <dd className="mb-1 font-mono text-xs break-all text-foreground/80 sm:mb-0">{value}</dd>
        </div>
      ))}
    </dl>
  )
}
