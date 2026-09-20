import { type ApiListResponse, type AxiosListResponse } from '@/types/api'

import type { ConsoleLogEntry, LogLevel } from '../models/console'

const path = '/v1/console'

/**
 * The console endpoint is not available on the server yet, so this service
 * keeps an in-memory log buffer matching what GET /v1/console would return.
 * Entries are generated once to mimic a live request/response cycle.
 */
function formatTime(ms: number): string {
  const date = new Date(ms)
  const hh = String(date.getUTCHours()).padStart(2, '0')
  const mm = String(date.getUTCMinutes()).padStart(2, '0')
  const ss = String(date.getUTCSeconds()).padStart(2, '0')
  const msec = String(date.getUTCMilliseconds()).padStart(3, '0')
  return `${hh}:${mm}:${ss}.${msec}`
}

function generateEntries(count: number): ConsoleLogEntry[] {
  const entries: ConsoleLogEntry[] = []
  let clock = Date.UTC(2026, 8, 20, 1, 0, 0)
  let id = 0

  const push = (level: LogLevel, message: string, detail?: string) => {
    id += 1
    entries.push({ id, time: formatTime(clock), level, message, detail })
  }
  const advance = (ms: number) => {
    clock += ms
  }

  while (id < count) {
    const batch = id % 3 === 0 ? 1 : id % 7 === 0 ? 9 : 4
    const model = 'glm-5-3-flash'
    const chunks = 15 + ((id * 37) % 800)
    const tokens = 600 + ((id * 517) % 25000)

    push('debug', 'Authenticated key "Dev"')
    push('debug', 'New request from "claude-code" (openai API)')
    push('debug', `Read request body (${30 + (id % 60)}.${id % 10} KB)`, 'body.json')
    push(
      'debug',
      `Routing "chain:glm" · ${batch} message${batch > 1 ? 's' : ''} · streaming`,
      'routing.json'
    )
    push('debug', `Resolved to custom-openai-kenari/${model} (+2 fallbacks)`, 'resolution.json')
    push('debug', 'Dispatching as streaming response')
    push('debug', 'Opening stream to provider…')
    advance(400 + ((id * 211) % 5000))
    push('debug', `Streaming from custom-openai-kenari/${model}`)
    advance(300 + ((id * 131) % 4000))
    push('debug', `Stream complete · ${chunks} chunks · ${tokens.toLocaleString()} tokens · 1.0s`)
    if (id % 7 === 0) {
      push(
        'warn',
        `Request completed · ${model} · ${tokens.toLocaleString()} tokens · $0.0000 · 11.6s`
      )
    } else {
      push(
        'info',
        `Request completed · ${model} · ${tokens.toLocaleString()} tokens · $0.0000 · 1.0s`
      )
    }
    if (id % 23 === 0) {
      advance(1000)
      push('error', 'Stream failed to start after 2m 5s')
      push('error', 'Request failed · chain:glm · 2m 5s')
    }
    advance(700 + ((id * 97) % 2500))
  }

  return entries
}

const MAX_LINES = 500

let entries: ConsoleLogEntry[] = generateEntries(MAX_LINES)

function get(): Promise<AxiosListResponse<ConsoleLogEntry>> {
  const body: ApiListResponse<ConsoleLogEntry> = {
    data: [...entries],
    metadata: {},
  }

  const response = { data: body } as AxiosListResponse<ConsoleLogEntry>

  return Promise.resolve(response)
}

function clear(): Promise<AxiosListResponse<ConsoleLogEntry>> {
  entries = []

  const body: ApiListResponse<ConsoleLogEntry> = {
    data: [],
    metadata: {},
  }

  const response = { data: body } as AxiosListResponse<ConsoleLogEntry>

  return Promise.resolve(response)
}

export const consoleServices = {
  path,
  get,
  clear,
}
