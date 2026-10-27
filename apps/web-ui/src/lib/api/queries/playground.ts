import { mutationOptions, queryOptions } from '@tanstack/react-query'

import type { Models } from '../models'

import { services } from '../services'

export const PLAYGROUND_QUERY_KEY = 'playground'

const models = () =>
  queryOptions({
    queryKey: [PLAYGROUND_QUERY_KEY, 'models'],
    queryFn: async () => {
      const res = await services.playground.models()
      return res.data
    },
  })

/** Streamed playground chat; resolves with the final result. */
const chat = () =>
  mutationOptions({
    mutationFn: ({
      onDelta,
      ...reqBody
    }: {
      model: string
      messages: Models.ModelTestMessage[]
      onDelta: (text: string) => void
    }) => services.playground.chat(reqBody, onDelta),
  })

export const playgroundQueries = { models, chat } as const
