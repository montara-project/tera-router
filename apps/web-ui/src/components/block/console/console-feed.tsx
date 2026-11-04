import {
  IconBulb,
  IconChevronRight,
  IconCopy,
  IconDownload,
  IconHelpCircle,
  IconSearch,
  IconTrash,
} from '@tabler/icons-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'

import type { ConsoleLogEntry, LogLevel } from '@/lib/api/models/console'

import SegmentedControl from '@/components/block/common/segmented-control'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useBranding } from '@/hooks/use-branding'
import { saveFile } from '@/lib/file'
import { cn } from '@/lib/utils'

type Entry = ConsoleLogEntry

const LEVELS: { level: LogLevel; label: string; chip: string; dot: string }[] = [
  {
    level: 'error',
    label: 'Error',
    chip: 'border-red-600/30 bg-red-600/10 text-red-700 dark:border-red-500/40 dark:bg-red-500/15 dark:text-red-400',
    dot: 'bg-red-500',
  },
  {
    level: 'warn',
    label: 'Warn',
    chip: 'border-amber-600/30 bg-amber-600/10 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-400',
    dot: 'bg-amber-500',
  },
  {
    level: 'info',
    label: 'Info',
    chip: 'border-sky-600/30 bg-sky-600/10 text-sky-700 dark:border-sky-500/40 dark:bg-sky-500/15 dark:text-sky-400',
    dot: 'bg-sky-500',
  },
  {
    level: 'debug',
    label: 'Debug',
    chip: 'border-border bg-muted/40 text-foreground/80',
    dot: 'bg-muted-foreground',
  },
]

/** Level word colors for the All lines view (AA on card in both themes). */
const LEVEL_TEXT: Record<LogLevel, string> = {
  error: 'text-red-700 dark:text-red-400',
  warn: 'text-amber-800 dark:text-amber-400',
  info: 'text-sky-700 dark:text-sky-400',
  debug: 'text-muted-foreground',
}

const VIEWS = [
  { value: 'requests', label: 'Requests' },
  { value: 'all', label: 'All lines' },
] as const

const FILTER_HELP = [
  ['is:failed', 'status 400 or above'],
  ['is:ok', 'status below 400'],
  ['is:rejected', 'refused before any upstream'],
  ['key:prod', 'API key name contains'],
  ['model:gpt', 'requested or served model contains'],
  ['status:5xx', 'status class, or an exact code'],
  ['ms>10s', 'slower than (ms<200 for faster)'],
] as const

function statusTone(status: number) {
  if (status < 400)
    return 'bg-emerald-500/10 text-emerald-700 ring-emerald-500/25 dark:text-emerald-400'
  if (status < 500) return 'bg-amber-500/10 text-amber-800 ring-amber-500/25 dark:text-amber-400'
  return 'bg-destructive/10 text-red-700 ring-destructive/25 dark:text-red-400'
}

function formatDuration(ms: number) {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`
}

/** "300000" → "5m 0s", "8000" → "8s" */
function formatRetry(ms: number) {
  const total = Math.round(ms / 1000)
  return total >= 60 ? `${Math.floor(total / 60)}m ${total % 60}s` : `${total}s`
}

/** What an upstream failure class means and what to do about it. */
const ERROR_HELP: Record<string, string> = {
  auth: 'The provider rejected the account credentials. Reconnect the account or update its API key.',
  rate_limit:
    'The provider is rate-limiting this account. Requests fall back to other accounts; wait, or add accounts to spread the load.',
  quota_exhausted:
    'The account used up its quota. Top it up or add another account for this provider.',
  account_suspended:
    'The provider refused the account for billing reasons (no balance, expired plan or suspension). Resolve it with the provider; the account stays disabled until then.',
  billing:
    'The provider refused the account for billing reasons. Resolve it with the provider, then re-enable the account.',
  upstream:
    'The provider returned a server error. This is usually temporary; the gateway retries and falls back.',
  upstream_blocked:
    "The provider's edge (WAF or CDN) blocked the request before it reached the model API. Check the provider's base URL and any IP restrictions.",
  timeout:
    'The provider stopped responding in time. Retry, or raise the timeout if long outputs are expected.',
  bad_request:
    'The provider refused the request as invalid. Check the parameters the client sends for this model.',
  context_too_large:
    "The conversation is longer than the model's context window. Trim the history or route to a model with a larger window.",
  capability:
    'The model lacks a feature this request needs, such as tools or images. Route it to a model that supports it.',
  model_not_found:
    "The model is not served by any active account. Check the model name, the account's model list, or whether the provider retired it.",
  budget_blocked:
    'A budget limit blocked the request. Raise the budget or wait for its period to reset.',
  capacity:
    'The provider is at capacity. Retry shortly; the gateway falls back to other accounts meanwhile.',
  tool_call_malformed:
    'The provider rejected a malformed tool call in the history. Fix the tool-call messages the client sends.',
  internal: 'The gateway hit an internal error. Check the server logs for this request.',
}

/** Explanations for requests the gateway refused before any upstream. */
const STATUS_HELP: Record<number, string> = {
  400: 'The gateway could not use the request as sent. Check the model name and the request body.',
  401: 'The request had no valid API key. Send it in an Authorization: Bearer header, using a key from API keys.',
  402: 'A budget for this key or account is used up. Raise it, or wait for its period to reset.',
  403: "This key isn't allowed to use that model. Add the model to the key's allowlist or its plan.",
  429: "The key hit its plan's rate limit. Wait for the Retry-After delay, or raise the plan's limits.",
  503: 'The gateway is at capacity or has no available account for the model. Retry shortly, or add accounts.',
}

/** Explanations keyed by the gateway's own rejection reason (prefix match). */
function reasonHelp(reason: string, brand: string): string | undefined {
  const rules: [string, string][] = [
    [
      'missing API key',
      `The request had no Authorization: Bearer or x-api-key header. Configure the client with a ${brand} API key.`,
    ],
    [
      'invalid API key',
      "The API key isn't recognized, or it was disabled or revoked. Check it on API keys, or create a new one.",
    ],
    [
      'unknown model',
      'No alias, chain or provider/model matches this name. Check the spelling, or create a model alias for it.',
    ],
    [
      'unknown provider',
      'No connected provider has that slug. Check the provider part of the model name.',
    ],
    ['model is required', 'The request body has no model. Send the model the client wants to use.'],
    [
      'no chain named',
      "No routing chain has that name. Check the chain's name after the chain: prefix.",
    ],
    [
      'chain is disabled',
      'That routing chain is turned off. Enable it on Chains, or use another model.',
    ],
    ['access denied', STATUS_HELP[403]],
  ]
  return rules.find(([prefix]) => reason.startsWith(prefix))?.[1]
}

function explain(r: NonNullable<Entry['request']>, brand: string) {
  if (r.status < 400) return null
  const text =
    (r.errorKind && ERROR_HELP[r.errorKind]) ||
    (r.reason && reasonHelp(r.reason, brand)) ||
    STATUS_HELP[r.status]
  if (!text) return null
  return r.retryAfterMs ? `${text} Retry-After: ${formatRetry(r.retryAfterMs)}.` : text
}

/** "10s" → 10000, "250" → 250 */
function parseMs(value: string) {
  const s =
    value.endsWith('s') && !value.endsWith('ms')
      ? Number(value.slice(0, -1)) * 1000
      : Number(value.replace(/ms$/, ''))
  return Number.isFinite(s) ? s : null
}

/** Applies one query token (filter or free text) to an entry. */
function matchToken(e: Entry, token: string): boolean {
  const r = e.request
  const lower = token.toLowerCase()
  const [field, ...rest] = lower.split(':')
  const value = rest.join(':')
  if (value) {
    if (!r) return false
    switch (field) {
      case 'is':
        if (value === 'failed') return r.status >= 400
        if (value === 'ok') return r.status < 400
        if (value === 'rejected') return r.outcome === 'rejected'
        return false
      case 'key':
        return (r.keyName ?? '').toLowerCase().includes(value)
      case 'model':
        return [r.model, r.servedBy].some((m) => (m ?? '').toLowerCase().includes(value))
      case 'status':
        return /^\dxx$/.test(value) ? String(r.status)[0] === value[0] : String(r.status) === value
    }
  }
  const range = /^ms([<>])(.+)$/.exec(lower)
  if (range) {
    const limit = parseMs(range[2])
    if (!r || limit === null) return false
    return range[1] === '>' ? r.durationMs > limit : r.durationMs < limit
  }
  return [e.message, e.detail, r?.requestId, r?.keyName, r?.endpoint, String(e.id)].some((v) =>
    (v ?? '').toLowerCase().includes(lower)
  )
}

/** One plain-text line per entry, for copy and download. */
function toLine(e: Entry) {
  const r = e.request
  return r
    ? `${e.time} ${r.status} #${e.id} ${e.message}${r.keyName ? ` key=${r.keyName}` : ''}`
    : `${e.time} ${e.level.toUpperCase()} ${e.message}`
}

interface ConsoleFeedProps {
  entries: Entry[]
  live: boolean
  onLiveChange: (live: boolean) => void
  onClear: () => void
}

export default function ConsoleFeed({ entries, live, onLiveChange, onClear }: ConsoleFeedProps) {
  const [query, setQuery] = useState('')
  const [view, setView] = useState<(typeof VIEWS)[number]['value']>('requests')
  const [levels, setLevels] = useState<LogLevel[]>([])
  const [follow, setFollow] = useState(true)
  const [expanded, setExpanded] = useState<number[]>([])
  const searchRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const scoped = useMemo(
    () => (view === 'requests' ? entries.filter((e) => e.request) : entries),
    [entries, view]
  )
  const counts = useMemo(() => {
    const map: Record<LogLevel, number> = { error: 0, warn: 0, info: 0, debug: 0 }
    for (const e of scoped) map[e.level] += 1
    return map
  }, [scoped])
  const visible = useMemo(() => {
    const tokens = query.trim().split(/\s+/).filter(Boolean)
    return scoped.filter(
      (e) =>
        (levels.length === 0 || levels.includes(e.level)) && tokens.every((t) => matchToken(e, t))
    )
  }, [scoped, levels, query])
  const allRequests = entries.filter((e) => e.request)
  const failed = allRequests.filter((e) => (e.request?.status ?? 0) >= 400).length
  const filtering = query.trim() !== '' || levels.length > 0
  const columns =
    view === 'all'
      ? 'grid-cols-[1.5rem_7rem_3.5rem_minmax(0,1fr)_auto]'
      : 'grid-cols-[1.5rem_7rem_3.25rem_minmax(0,1fr)_auto]'

  /** Jump from a line to the full request view of the same entry. */
  const openRequest = (id: number) => {
    setView('requests')
    setQuery('')
    setLevels([])
    setFollow(false)
    setExpanded([id])
    requestAnimationFrame(() =>
      document.getElementById(`console-row-${id}`)?.scrollIntoView({ block: 'start' })
    )
  }

  // Follow keeps the newest row (at the bottom) in view as lines arrive.
  useEffect(() => {
    const el = listRef.current
    if (follow && el) el.scrollTop = el.scrollHeight
  }, [visible.length, follow])

  // "/" jumps to the search box from anywhere on the page.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (
        e.key === '/' &&
        !/input|textarea|select/i.test(target.tagName) &&
        !target.isContentEditable
      ) {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const toggle = <T,>(list: T[], item: T) =>
    list.includes(item) ? list.filter((x) => x !== item) : [...list, item]

  const text = () => visible.map(toLine).join('\n')
  const handleCopy = () =>
    navigator.clipboard
      .writeText(text())
      .then(() => toast.success(`Copied ${visible.length} lines`))
      .catch(() => toast.error('Unable to copy. Allow clipboard access and try again.'))
  const handleDownload = () =>
    saveFile(
      new Blob([text()], { type: 'text/plain' }),
      `console-${new Date().toISOString().slice(0, 19)}.log`
    )

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex flex-col gap-2.5 border-b border-border p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-60 flex-1">
            <IconSearch
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
              stroke={1.75}
              aria-hidden
            />
            <Input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search, or filter: is:failed key:prod status:5xx ms>10s"
              aria-label="Search or filter the console"
              className="h-8 pr-16 pl-8 font-mono text-[12.5px]"
            />
            <div className="absolute top-1/2 right-1.5 flex -translate-y-1/2 items-center gap-1">
              <kbd className="text-muted-foreground rounded-[4px] border border-border px-1.5 font-mono text-[10.5px] leading-[17px]">
                /
              </kbd>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label="Filter syntax"
                    className="text-muted-foreground hover:text-foreground flex size-6 items-center justify-center rounded-sm"
                  >
                    <IconHelpCircle className="size-4" stroke={1.75} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  <ul className="flex flex-col gap-1 text-xs">
                    {FILTER_HELP.map(([token, hint]) => (
                      <li key={token}>
                        <code className="font-mono">{token}</code> — {hint}
                      </li>
                    ))}
                  </ul>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>

          <SegmentedControl aria-label="Rows" options={VIEWS} value={view} onChange={setView} />

          <div className="flex items-center gap-3 px-1 text-xs">
            <div className="flex items-center gap-1.5">
              <span
                className={cn(
                  'size-1.5 rounded-full',
                  live ? 'bg-emerald-500' : 'bg-muted-foreground'
                )}
                aria-hidden
              />
              <label htmlFor="console-live" className="cursor-pointer">
                Live
              </label>
              <Switch id="console-live" checked={live} onCheckedChange={onLiveChange} size="sm" />
            </div>
            <div className="flex items-center gap-1.5">
              <Switch id="console-follow" checked={follow} onCheckedChange={setFollow} size="sm" />
              <label htmlFor="console-follow" className="cursor-pointer">
                Follow
              </label>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              aria-label="Copy visible lines"
              onClick={handleCopy}
            >
              <IconCopy />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              aria-label="Download visible lines"
              onClick={handleDownload}
            >
              <IconDownload />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              aria-label="Clear console"
              onClick={onClear}
            >
              <IconTrash />
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <div role="group" aria-label="Levels" className="flex flex-wrap gap-1.5">
            {LEVELS.map((l) => {
              const active = levels.includes(l.level)
              return (
                <button
                  key={l.level}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setLevels((cur) => toggle(cur, l.level))}
                  className={cn(
                    'inline-flex h-7 items-center gap-1.5 rounded-sm border px-2.5 text-xs font-medium transition-colors',
                    active || levels.length === 0 ? l.chip : 'text-muted-foreground border-border'
                  )}
                >
                  <span className={cn('size-1.5 rounded-full', l.dot)} aria-hidden />
                  {l.label}
                  <span className="tabular-nums">{counts[l.level]}</span>
                </button>
              )
            })}
          </div>
          {filtering && (
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto h-7"
              onClick={() => {
                setQuery('')
                setLevels([])
              }}
            >
              Reset filters
            </Button>
          )}
        </div>
      </div>

      <div
        className={cn(
          'text-muted-foreground grid items-center gap-3 border-b border-border px-3 py-1.5 text-xs dark:bg-muted/40',
          columns
        )}
        aria-hidden
      >
        <span />
        <span>{view === 'all' ? 'Time' : 'Started'}</span>
        <span>{view === 'all' ? 'Level' : 'Status'}</span>
        <span>{view === 'all' ? 'Message' : 'What happened'}</span>
        <span>{view === 'all' ? 'Key' : 'Key · Duration'}</span>
      </div>

      <div
        ref={listRef}
        className="scrollbar-seamless min-h-0 flex-1 overflow-y-auto overscroll-contain"
      >
        {visible.length === 0 && (
          <p className="text-muted-foreground p-6 text-center text-sm">
            {entries.length === 0
              ? 'No activity yet. Send a request to the gateway and it shows up here.'
              : 'No lines match these filters.'}
          </p>
        )}
        <ul>
          {visible.map((e) => (
            <ConsoleRow
              key={e.id}
              entry={e}
              lines={view === 'all'}
              columns={columns}
              open={expanded.includes(e.id)}
              onToggle={() => setExpanded((cur) => toggle(cur, e.id))}
              onOpenRequest={() => openRequest(e.id)}
            />
          ))}
        </ul>
      </div>

      <footer className="text-muted-foreground flex flex-wrap items-center justify-between gap-2 border-t border-border px-3 py-1.5 text-xs">
        <span className="flex items-center gap-1.5 tabular-nums">
          {visible.length === scoped.length
            ? `${visible.length} lines`
            : `${visible.length} of ${scoped.length} lines`}{' '}
          · {allRequests.length} requests ·
          <button
            type="button"
            onClick={() => setQuery((q) => (q.includes('is:failed') ? q : `${q} is:failed`.trim()))}
            className="text-red-700 hover:underline dark:text-red-400"
          >
            {failed} failed
          </button>
        </span>
        <span>Keeps the latest 1,000 lines</span>
      </footer>
    </section>
  )
}

function ConsoleRow({
  entry: e,
  lines,
  columns,
  open,
  onToggle,
  onOpenRequest,
}: {
  entry: Entry
  /** All-lines view: level column and a compact, error-first detail. */
  lines: boolean
  columns: string
  open: boolean
  onToggle: () => void
  onOpenRequest: () => void
}) {
  const r = e.request
  const expandable = Boolean(r || e.detail)
  const level = LEVELS.find((l) => l.level === e.level)!

  return (
    <li id={`console-row-${e.id}`} className="border-b border-border/60 last:border-0">
      <button
        type="button"
        onClick={onToggle}
        disabled={!expandable}
        aria-expanded={expandable ? open : undefined}
        className={cn(
          'hover:bg-muted/40 grid w-full items-center gap-3 px-3 py-1.5 text-left font-mono text-[12.5px] disabled:cursor-default',
          columns
        )}
      >
        <IconChevronRight
          className={cn(
            'text-muted-foreground size-3.5 transition-transform',
            open && 'rotate-90',
            !expandable && 'invisible'
          )}
          aria-hidden
        />
        <span className="text-muted-foreground tabular-nums">{e.time}</span>
        <span>
          {lines ? (
            <span className={cn('text-[11.5px] font-medium uppercase', LEVEL_TEXT[e.level])}>
              {e.level}
            </span>
          ) : r ? (
            <span
              className={cn(
                'inline-flex rounded-[4px] px-1 text-[11px] ring-1 ring-inset',
                statusTone(r.status)
              )}
            >
              {r.status}
            </span>
          ) : (
            <span
              className={cn(
                'inline-flex rounded-[4px] border px-1 font-sans text-[10.5px] uppercase',
                level.chip
              )}
            >
              {e.level}
            </span>
          )}
        </span>
        <span className="truncate" title={e.message}>
          {r && <span className="text-muted-foreground">#{e.id} </span>}
          {e.message}
        </span>
        <span className="text-muted-foreground flex items-center gap-6 tabular-nums">
          {r?.keyName && <span className="max-w-40 truncate">{r.keyName}</span>}
          {r && !lines && <span className="w-12 text-right">{formatDuration(r.durationMs)}</span>}
        </span>
      </button>

      {open && r && !lines && <RequestDetail id={e.id} request={r} />}
      {open && r && lines && <LineDetail entry={e} request={r} onOpenRequest={onOpenRequest} />}
      {open && !r && e.detail && (
        <pre className="text-muted-foreground mx-3 mb-2 ml-12 overflow-x-auto rounded-md border border-border p-3 font-mono text-xs whitespace-pre-wrap">
          {e.detail}
        </pre>
      )}
    </li>
  )
}

function RequestDetail({ id, request: r }: { id: number; request: NonNullable<Entry['request']> }) {
  const fields: [string, string | undefined][] = [
    ['Request', `#${id} (${r.requestId || 'no id'})`],
    ['Endpoint', r.endpoint],
    ['API key', r.keyName],
    ['Client', r.client],
    ['Model', r.model],
    ['Served by', r.servedBy],
    ['Status', String(r.status)],
    ['Reason', r.reason],
    ['Duration', formatDuration(r.durationMs)],
    ['Tokens', String(r.tokens)],
    ['Mode', r.mode],
    ['Time', new Date(r.startedAt).toLocaleString()],
    ['IP', r.ip],
    ['Account', r.account],
    ['Chunks', r.chunks ? String(r.chunks) : undefined],
    ...upstreamFields(r),
  ]

  const handleCopy = () =>
    navigator.clipboard
      .writeText(JSON.stringify({ id, ...r }, null, 2))
      .then(() => toast.success('Request copied'))
      .catch(() => toast.error('Unable to copy. Allow clipboard access and try again.'))

  return (
    <div className="mb-3 ml-12 mr-3 flex flex-col gap-3 border-l border-border pl-4 font-mono text-[12.5px]">
      <Explanation request={r} />
      <dl className="grid grid-cols-[6rem_minmax(0,1fr)] gap-x-3 gap-y-1">
        {fields
          .filter(([, v]) => v)
          .map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="break-all">{v}</dd>
            </div>
          ))}
      </dl>
      <div>
        <p className="text-muted-foreground mb-1 font-sans text-xs">Timeline</p>
        <ol className="flex flex-col gap-1">
          {r.events.map((ev, i) => (
            <li key={i} className="grid grid-cols-[4rem_0.75rem_minmax(0,1fr)] items-center gap-2">
              <span className="text-muted-foreground text-right tabular-nums">
                +{formatDuration(ev.offsetMs)}
              </span>
              <span
                className={cn(
                  'size-1.5 rounded-full',
                  ev.kind === 'completed'
                    ? 'bg-primary'
                    : /failed|rejected/.test(ev.kind)
                      ? 'bg-red-500'
                      : 'bg-muted-foreground'
                )}
                aria-hidden
              />
              <span className={cn('break-words', i === r.events.length - 1 && 'font-medium')}>
                {ev.text}
              </span>
            </li>
          ))}
        </ol>
      </div>
      <div>
        <Button variant="ghost" size="sm" className="font-sans" onClick={handleCopy}>
          <IconCopy />
          Copy request
        </Button>
      </div>
    </div>
  )
}

/** Upstream failure fields, present only when an attempt failed. */
function upstreamFields(r: NonNullable<Entry['request']>): [string, string | undefined][] {
  return [
    ['Provider', r.provider],
    ['Error kind', r.errorKind],
    ['Upstream status', r.upstreamStatus ? String(r.upstreamStatus) : undefined],
    ['Retry after', r.retryAfterMs ? formatRetry(r.retryAfterMs) : undefined],
  ]
}

/** "What this means" callout for a failed or rejected request. */
function Explanation({ request }: { request: NonNullable<Entry['request']> }) {
  const brand = useBranding().name
  const text = explain(request, brand)
  if (!text) return null
  return (
    <p className="flex gap-2 rounded-md border border-border px-3 py-2 font-sans text-[13px]">
      <IconBulb className="mt-0.5 size-4 shrink-0 text-amber-500" stroke={1.75} aria-hidden />
      <span>
        <span className="font-medium">What this means: </span>
        {text}
      </span>
    </p>
  )
}

/** Compact detail for a request row in the All lines view. */
function LineDetail({
  entry: e,
  request: r,
  onOpenRequest,
}: {
  entry: Entry
  request: NonNullable<Entry['request']>
  onOpenRequest: () => void
}) {
  const fields: [string, string | undefined][] = [
    ['Request', `#${e.id} (${r.requestId || 'no id'})`],
    ['Endpoint', r.endpoint],
    ['API key', r.keyName],
    ['Client', r.client],
    ['Model', r.model],
    ['Served by', r.servedBy],
    ['Status', String(r.status)],
    ['Duration', formatDuration(r.durationMs)],
    ['Tokens', r.servedBy ? String(r.tokens) : undefined],
    ['Mode', r.mode],
    ['Time', new Date(r.startedAt).toLocaleString()],
    ['IP', r.ip],
    ['Account', r.account],
    ['Chunks', r.chunks ? String(r.chunks) : undefined],
    ...upstreamFields(r),
  ]
  // The upstream's own words, when they add something to the summary.
  const raw = r.upstreamMessage && !e.message.includes(r.upstreamMessage) ? r.upstreamMessage : null

  const handleCopy = () =>
    navigator.clipboard
      .writeText(toLine(e))
      .then(() => toast.success('Line copied'))
      .catch(() => toast.error('Unable to copy. Allow clipboard access and try again.'))

  return (
    <div className="mb-3 ml-12 mr-3 flex flex-col gap-3 border-l border-border pl-4 font-mono text-[12.5px]">
      <Explanation request={r} />
      <dl className="grid grid-cols-[8rem_minmax(0,1fr)] gap-x-3 gap-y-1">
        {fields
          .filter(([, v]) => v)
          .map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="break-all">{v}</dd>
            </div>
          ))}
      </dl>
      {raw && <p className="text-muted-foreground break-words">{raw}</p>}
      <div className="flex flex-wrap gap-1 font-sans">
        <Button variant="ghost" size="sm" onClick={handleCopy}>
          <IconCopy />
          Copy line
        </Button>
        <Button variant="ghost" size="sm" onClick={onOpenRequest}>
          Open whole request #{e.id}
        </Button>
      </div>
    </div>
  )
}
