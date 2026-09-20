import { IconPointFilled, IconSearch } from '@tabler/icons-react'
import { useMemo, useState } from 'react'

import type { ConsoleLogEntry, LogLevel } from '@/lib/api/models/console'

import { Input } from '@/components/ui/input'

const LEVEL_META: Record<LogLevel, { label: string; badgeClass: string; chipClass: string }> = {
  debug: {
    label: 'DEBUG',
    badgeClass: 'bg-primary/15 text-primary',
    chipClass: 'bg-primary/10 text-primary',
  },
  info: {
    label: 'INFO',
    badgeClass: 'bg-sky-600/20 text-sky-400',
    chipClass: 'bg-sky-600/15 text-sky-300',
  },
  warn: {
    label: 'WARN',
    badgeClass: 'bg-amber-600/20 text-amber-400',
    chipClass: 'bg-amber-600/15 text-amber-300',
  },
  error: {
    label: 'ERROR',
    badgeClass: 'bg-red-600/20 text-red-400',
    chipClass: 'bg-red-600/15 text-red-300',
  },
}

const FILTERS: LogLevel[] = ['debug', 'info', 'warn', 'error']

interface ConsoleLogProps {
  entries: ConsoleLogEntry[]
}

export default function ConsoleLog({ entries }: ConsoleLogProps) {
  const [search, setSearch] = useState('')
  const [levels, setLevels] = useState<LogLevel[]>([])

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

  return (
    <div className="space-y-4">
      <div className="bg-sidebar flex flex-wrap items-center gap-3 rounded-xl border border-sidebar-accent p-2">
        <div className="relative min-w-0 flex-1">
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
              className={LEVEL_META[level].chipClass}
            >
              {LEVEL_META[level].label} {counts[level]}
            </button>
          )
        })}
        <span className="text-muted-foreground flex shrink-0 items-center gap-1.5 px-1 text-xs">
          <IconPointFilled className="h-4 w-4 text-emerald-500" />
          Live
        </span>
      </div>

      <div className="bg-card overflow-hidden rounded-xl border border-border">
        <div className="max-h-[62vh] divide-y divide-border/60 overflow-y-auto">
          {filtered.map((entry) => {
            const meta = LEVEL_META[entry.level]

            return (
              <div
                key={entry.id}
                className={`group flex items-center gap-3 px-4 py-1.5 font-mono text-xs ${
                  entry.level === 'error' ? 'bg-red-950/20' : undefined
                }`}
              >
                <span className="text-muted-foreground w-8 shrink-0 text-right">{entry.id}</span>
                <span className="text-muted-foreground w-24 shrink-0">{entry.time}</span>
                <span
                  className={`w-14 shrink-0 rounded px-1.5 py-0.5 text-center text-[10px] font-bold ${meta.badgeClass}`}
                >
                  {meta.label}
                </span>
                <span className="text-foreground min-w-0 flex-1 truncate">{entry.message}</span>
                <span className="text-muted-foreground shrink-0 text-[11px] group-hover:underline">
                  detail
                </span>
              </div>
            )
          })}
          {filtered.length === 0 && (
            <p className="text-muted-foreground py-16 text-center text-sm">
              No log entries match the current filters.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

export { FILTERS }
