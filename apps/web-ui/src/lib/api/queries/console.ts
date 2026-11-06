import { mutationOptions, queryOptions } from '@tanstack/react-query'

import { getQueryClient } from '@/lib/providers/react-query'

import type { ConsoleLogEntry } from '../models/console'

import { services } from '../services'

export const CONSOLE_QUERY_KEY = 'console'

export const GET_CONSOLE_QUERY_KEY = () => {
  return [CONSOLE_QUERY_KEY, 'detail']
}

/** The feed as the client holds it: every line seen so far, oldest first. */
export type ConsoleFeed = { entries: ConsoleLogEntry[]; session: string }

/** Mirrors the server's ring buffer (consolelog.Capacity). */
const FEED_CAPACITY = 1000

/**
 * Polls only what changed: asks for lines after the newest one held, appends
 * them, and drops held lines older than the server's oldest (trimmed or
 * cleared). With nothing new it returns the held feed itself, so a live view
 * polling every two seconds re-renders nothing. A new server session (the
 * process restarted and its ids began again) starts the feed over.
 */
const get = () =>
  queryOptions({
    queryKey: GET_CONSOLE_QUERY_KEY(),
    queryFn: async (): Promise<ConsoleFeed> => {
      let held = getQueryClient().getQueryData<ConsoleFeed>(GET_CONSOLE_QUERY_KEY())
      let res = (await services.console.get(held?.entries.at(-1)?.id)).data
      if (held && res.metadata.session !== held.session) {
        held = undefined
        res = (await services.console.get()).data
      }

      const first = Number(res.metadata.first ?? 0)
      const kept = held ? held.entries.filter((e) => e.id >= first) : []
      if (held && res.data.length === 0 && kept.length === held.entries.length) {
        return held
      }
      return {
        entries: [...kept, ...res.data].slice(-FEED_CAPACITY),
        session: String(res.metadata.session ?? ''),
      }
    },
    // Unchanged lines keep their objects already; skip the deep compare.
    structuralSharing: false,
  })

const clear = () => {
  const qc = getQueryClient()

  return mutationOptions({
    mutationFn: async () => {
      const res = await services.console.clear()
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [CONSOLE_QUERY_KEY] })
    },
  })
}

export const consoleQueries = {
  get,
  clear,
} as const
