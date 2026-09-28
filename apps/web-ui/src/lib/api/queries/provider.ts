import { queryOptions } from '@tanstack/react-query'

import { services } from '../services'

export const CUSTOM_PROVIDER_QUERY_KEY = 'custom-providers'
export const PROVIDER_QUERY_KEY = 'providers'

const list = () =>
  queryOptions({
    queryKey: [PROVIDER_QUERY_KEY],
    queryFn: async () => {
      const res = await services.providers.list()
      return res.data
    },
  })

const customList = () =>
  queryOptions({
    queryKey: [CUSTOM_PROVIDER_QUERY_KEY],
    queryFn: async () => {
      const res = await services.providers.customList()
      return res.data
    },
  })

const customGet = (id: string) =>
  queryOptions({
    queryKey: [CUSTOM_PROVIDER_QUERY_KEY, id],
    queryFn: async () => {
      const res = await services.providers.customList()
      const provider = res.data.data.find((item) => item.id === id)
      if (!provider) throw new Error('Custom provider not found')
      return provider
    },
  })

export const providerQueries = {
  list,
  customList,
  customGet,
} as const
