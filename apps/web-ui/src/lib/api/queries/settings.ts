import { queryOptions } from '@tanstack/react-query'

import { services } from '../services'

export const SETTINGS_QUERY_KEY = 'settings'

const get = () =>
  queryOptions({
    queryKey: [SETTINGS_QUERY_KEY],
    queryFn: async () => {
      const res = await services.settings.get()
      return res.data
    },
  })

export const settingsQueries = {
  get,
} as const
