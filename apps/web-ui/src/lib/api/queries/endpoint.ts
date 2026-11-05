import { queryOptions } from '@tanstack/react-query'

import { services } from '../services'

export const ENDPOINT_QUERY_KEY = 'endpoints'

export const GET_ENDPOINT_CATALOG_QUERY_KEY = () => {
  return [ENDPOINT_QUERY_KEY, 'catalog']
}

const catalog = () =>
  queryOptions({
    queryKey: GET_ENDPOINT_CATALOG_QUERY_KEY(),
    queryFn: async () => {
      const res = await services.endpoints.catalog()
      return res.data.data
    },
    staleTime: Infinity,
  })

export const endpointQueries = {
  catalog,
} as const
