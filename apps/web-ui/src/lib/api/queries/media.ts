import { queryOptions } from '@tanstack/react-query'

import { services } from '../services'

export const MEDIA_QUERY_KEY = 'media'

export const LIST_MEDIA_QUERY_KEY = () => {
  return [MEDIA_QUERY_KEY, 'list']
}

const list = () =>
  queryOptions({
    queryKey: LIST_MEDIA_QUERY_KEY(),
    queryFn: async () => {
      const res = await services.media.list()
      return res.data
    },
  })

export const mediaQueries = {
  list,
} as const
