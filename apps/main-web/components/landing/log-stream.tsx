'use client'

import { Search } from 'lucide-react'
import { useEffect, useState } from 'react'

const logLevel = {
  INF: 'text-faint',
  WRN: 'bg-amber-400/15 text-amber-300',
  ERR: 'bg-red-500/15 text-red-300',
} as const

type Entry = { level: keyof typeof logLevel; source: string; text: string }
type Row = Entry & { id: number; time: string }

// Sample traffic, replayed in order. Every event type exists in apps/server:
// dialect routing, 429 cooldowns, fallback, allowlists, search, embeddings.
const pool: Entry[] = [
  { level: 'INF', source: 'chat', text: 'gemini-2.5-pro → gemini#2 · 200 · 1,204 tok' },
  { level: 'WRN', source: 'messages', text: 'anthropic#1 429 · cooling down 60s' },
  { level: 'INF', source: 'messages', text: 'claude-sonnet-4.5 → anthropic#2 · fallback · 200' },
  { level: 'ERR', source: 'guardrail', text: 'key tr_live_…9f2 · model not in allowlist' },
  { level: 'INF', source: 'responses', text: 'gpt-5-codex → codex · stream · 22.7k tok' },
  { level: 'INF', source: 'search', text: 'exa · 200 · 8 results · 412 ms' },
  { level: 'WRN', source: 'chat', text: 'openrouter 503 · retrying on groq#1' },
  { level: 'INF', source: 'embeddings', text: 'voyage-3 → voyage-ai · 200 · 2,048 tok' },
]

const VISIBLE = 6
const TICK_MS = 1800
const START = 17 * 3600 + 2 * 60 + 9 // 17:02:09

const clock = (s: number) =>
  [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60]
    .map((n) => String(n).padStart(2, '0'))
    .join(':')

// Newest first; ids double as the replay position and the timestamp offset.
const rowAt = (id: number): Row => ({ ...pool[id % pool.length]!, id, time: clock(START + id) })
const initial = Array.from({ length: VISIBLE }, (_, i) => rowAt(VISIBLE - 1 - i))

/**
 * A live tail: a new request lands on top every TICK_MS, slides in with a
 * brief highlight, and pushes the older ones down into the fade-out.
 * Frozen on the initial lines under reduced motion.
 */
export function LogStream() {
  const [rows, setRows] = useState(initial)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const timer = setInterval(() => {
      setRows((prev) => [rowAt(prev[0]!.id + 1), ...prev].slice(0, VISIBLE))
    }, TICK_MS)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="fade-b overflow-hidden rounded-xl border border-line bg-panel p-3 sm:p-4">
      <div className="flex items-center gap-2.5 rounded-lg border border-line bg-raised/60 px-3 py-2 text-sm text-faint">
        <Search aria-hidden className="size-3.5" />
        <span className="flex-1 truncate">Filter requests, keys, models…</span>
        <span className="flex items-center gap-1.5 font-mono text-[11px] text-accent-soft">
          <span aria-hidden className="relative flex size-1.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-75" />
            <span className="relative inline-flex size-1.5 rounded-full bg-accent" />
          </span>
          live
        </span>
      </div>
      <ul className="mt-2 h-[9.5rem] overflow-hidden font-mono text-xs">
        {rows.map((row) => (
          <li
            className={`flex items-center gap-3 rounded-md px-1 py-1 whitespace-nowrap ${
              row.id >= VISIBLE ? 'log-row-in' : ''
            }`}
            key={row.id}
          >
            <span className="text-faint">{row.time}</span>
            <span className={`rounded px-1 py-0.5 text-[10px] ${logLevel[row.level]}`}>
              {row.level}
            </span>
            <span className="w-20 shrink-0 text-ink">{row.source}</span>
            <span className="truncate text-dim">{row.text}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
