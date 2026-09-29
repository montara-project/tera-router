import { mutationOptions, queryOptions } from '@tanstack/react-query'

import { getQueryClient } from '@/lib/providers/react-query'

import { services } from '../services'

export const CONSOLE_QUERY_KEY = 'console'

export const GET_CONSOLE_QUERY_KEY = () => {
  return [CONSOLE_QUERY_KEY, 'detail']
}

const get = () =>
  queryOptions({
    queryKey: GET_CONSOLE_QUERY_KEY(),
    queryFn: async () => {
      const res = await services.console.get()
      return res.data
    },
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
