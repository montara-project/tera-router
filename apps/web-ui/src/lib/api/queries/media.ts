import { queryOptions } from '@tanstack/react-query'

import { services } from '../services'

export const MEDIA_QUERY_KEY = 'media'

const list = () =>
  queryOptions({
    queryKey: [MEDIA_QUERY_KEY],
    queryFn: async () => {
      const res = await services.media.list()
      return res.data
    },
  })

export const mediaQueries = {
  list,
} as const
