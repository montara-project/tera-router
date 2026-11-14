import { queryOptions } from '@tanstack/react-query'

import { services } from '../services'

export const MEDIA_QUERY_KEY = 'media'

type MediaListParams = Parameters<typeof services.media.list>[0]

export const LIST_MEDIA_QUERY_KEY = (params?: MediaListParams) => {
  return [MEDIA_QUERY_KEY, 'list', params]
}

/** Media providers the server keeps after the capability and search in
 * `params`, also split into connected and available. */
const list = (params?: MediaListParams) =>
  queryOptions({
    queryKey: LIST_MEDIA_QUERY_KEY(params),
    queryFn: async () => {
      const res = await services.media.list(params)
      return res.data
    },
  })

export const mediaQueries = {
  list,
} as const
