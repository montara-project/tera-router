import { IconChevronDown, IconPointFilled, IconSearch } from '@tabler/icons-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import type { ConsoleLogEntry, LogLevel } from '@/lib/api/models/console'

import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

const LEVEL_META: Record<LogLevel, { label: string; badgeClass: string; activeChipClass: string }> =
  {
    debug: {
      label: 'DEBUG',
      badgeClass: 'bg-primary/10 text-primary',
      activeChipClass: 'border-primary/30 bg-primary/10 text-primary',
    },
    info: {
      label: 'INFO',
      badgeClass: 'bg-sky-600/15 text-sky-700 dark:bg-sky-600/20 dark:text-sky-400',
      activeChipClass:
        'border-sky-600/30 bg-sky-600/10 text-sky-700 dark:border-sky-500/40 dark:bg-sky-500/15 dark:text-sky-400',
    },
    warn: {
      label: 'WARN',
      badgeClass: 'bg-amber-600/15 text-amber-700 dark:bg-amber-600/20 dark:text-amber-400',
      activeChipClass:
        'border-amber-600/30 bg-amber-600/10 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-400',
    },
    error: {
      label: 'ERROR',
      badgeClass: 'bg-red-600/15 text-red-700 dark:bg-red-600/20 dark:text-red-400',
      activeChipClass:
        'border-red-600/30 bg-red-600/10 text-red-700 dark:border-red-500/40 dark:bg-red-500/15 dark:text-red-400',
    },
  }

const FILTERS: LogLevel[] = ['debug', 'info', 'warn', 'error']

interface ConsoleLogProps {
  entries: ConsoleLogEntry[]
}

export default function ConsoleLog({ entries }: ConsoleLogProps) {
  const [search, setSearch] = useState('')
  const [levels, setLevels] = useState<LogLevel[]>([])
  const [expanded, setExpanded] = useState<number[]>([])

  const listRef = useRef<HTMLDivElement>(null)
  const newestIdRef = useRef<number | null>(null)

  // Pin the view to the newest entry, but only when the newest id actually
  // changes so query refetches don't yank the list while reading.
  useEffect(() => {
    const newest = entries.length > 0 ? entries[entries.length - 1].id : null
    if (newest !== newestIdRef.current) {
      newestIdRef.current = newest
      const element = listRef.current
      if (element) element.scrollTop = element.scrollHeight
    }
  }, [entries])

  const counts = useMemo(() => {
    const map: Record<LogLevel, number> = { debug: 0, info: 0, warn: 0, error: 0 }
    for (const entry of entries) map[entry.level] += 1
    return map
  }, [entries])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return entries.filter((entry) => {
      if (levels.length > 0 && !levels.includes(entry.level)) return false
      if (query && !entry.message.toLowerCase().includes(query)) return false
      return true
    })
  }, [entries, search, levels])

  const toggleLevel = (level: LogLevel) => {
    setLevels((current) =>
      current.includes(level) ? current.filter((item) => item !== level) : [...current, level]
    )
  }

  const toggleDetail = (id: number) => {
    setExpanded((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <IconSearch className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            aria-label="Search logs"
            placeholder="Search logs..."
            value={search}
            variant="sm"
            className="bg-background pl-9"
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {FILTERS.map((level) => {
          const active = levels.includes(level)

          return (
            <button
              key={level}
              type="button"
              aria-pressed={active}
              onClick={() => toggleLevel(level)}
              className={cn(
                'inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1.5 font-mono text-xs font-semibold transition-colors',
                active
                  ? LEVEL_META[level].activeChipClass
                  : 'text-muted-foreground border-border bg-transparent hover:bg-accent hover:text-foreground'
              )}
            >
              {LEVEL_META[level].label}
              <span className="tabular-nums opacity-60">{counts[level]}</span>
            </button>
          )
        })}
        <span className="text-muted-foreground flex shrink-0 items-center gap-1.5 px-1 text-xs">
          <IconPointFilled className="h-4 w-4 animate-pulse text-emerald-500" />
          Live
        </span>
      </div>

      <div className="bg-card overflow-hidden rounded-xl border border-border">
        <div ref={listRef} className="max-h-[62vh] divide-y divide-border/60 overflow-y-auto">
          {filtered.map((entry) => {
            const meta = LEVEL_META[entry.level]
            const detailOpen = expanded.includes(entry.id)

            return (
              <div key={entry.id}>
                <div
                  className={cn(
                    'group flex items-center gap-3 px-4 py-1.5 font-mono text-xs transition-colors hover:bg-muted/40',
                    entry.level === 'error' && 'bg-red-50/60 dark:bg-red-950/20'
                  )}
                >
                  <span className="text-muted-foreground w-8 shrink-0 text-right">{entry.id}</span>
                  <span className="text-muted-foreground w-24 shrink-0">{entry.time}</span>
                  <span
                    className={cn(
                      'w-14 shrink-0 rounded px-1.5 py-0.5 text-center text-[10px] font-bold',
                      meta.badgeClass
                    )}
                  >
                    {meta.label}
                  </span>
                  <span className="text-foreground min-w-0 flex-1 truncate">{entry.message}</span>
                  {entry.detail ? (
                    <button
                      type="button"
                      aria-expanded={detailOpen}
                      onClick={() => toggleDetail(entry.id)}
                      className="text-muted-foreground flex shrink-0 cursor-pointer items-center gap-1 rounded px-1 py-0.5 text-[11px] transition-colors hover:text-foreground focus-visible:outline-hidden"
                    >
                      detail
                      <IconChevronDown
                        className={cn('h-3 w-3 transition-transform', detailOpen && 'rotate-180')}
                      />
                    </button>
                  ) : null}
                </div>
                {detailOpen && entry.detail ? (
                  <div className="bg-muted/30 border-t border-border/60 px-4 py-2 pl-[7.75rem] font-mono text-xs whitespace-pre-wrap text-muted-foreground">
                    {entry.detail}
                  </div>
                ) : null}
              </div>
            )
          })}
          {filtered.length === 0 && (
            <Empty className="rounded-none border-0 py-16">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <IconSearch />
                </EmptyMedia>
                <EmptyTitle>No log entries found</EmptyTitle>
                <EmptyDescription>Try a different search or level filter.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </div>
      </div>
    </div>
  )
}

export { FILTERS }
