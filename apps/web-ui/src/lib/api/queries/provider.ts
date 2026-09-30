import { mutationOptions, queryOptions } from '@tanstack/react-query'

import { getQueryClient } from '@/lib/providers/react-query'

import type { CustomProviderDto } from '../dtos/provider/schema'

import { services } from '../services'

export const CUSTOM_PROVIDER_QUERY_KEY = 'custom-providers'
export const PROVIDER_QUERY_KEY = 'providers'

export const LIST_PROVIDER_QUERY_KEY = () => {
  return [PROVIDER_QUERY_KEY, 'list']
}

export const LIST_CUSTOM_PROVIDER_QUERY_KEY = () => {
  return [CUSTOM_PROVIDER_QUERY_KEY, 'list']
}

export const GET_CUSTOM_PROVIDER_QUERY_KEY = (id: string) => {
  return [CUSTOM_PROVIDER_QUERY_KEY, 'detail', id]
}

const list = () =>
  queryOptions({
    queryKey: LIST_PROVIDER_QUERY_KEY(),
    queryFn: async () => {
      const res = await services.providers.list()
      return res.data
    },
  })

const customList = () =>
  queryOptions({
    queryKey: LIST_CUSTOM_PROVIDER_QUERY_KEY(),
    queryFn: async () => {
      const res = await services.providers.customList()
      return res.data
    },
  })

const customGet = (id: string) =>
  queryOptions({
    queryKey: GET_CUSTOM_PROVIDER_QUERY_KEY(id),
    queryFn: async () => {
      const res = await services.providers.customList()
      const provider = res.data.data.find((item) => item.id === id)
      if (!provider) throw new Error('Custom provider not found')
      return provider
    },
  })

const customCreate = () => {
  const qc = getQueryClient()

  return mutationOptions({
    mutationFn: async (reqBody: CustomProviderDto) => {
      const res = await services.providers.customStore(reqBody)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [PROVIDER_QUERY_KEY] })
      qc.invalidateQueries({ queryKey: [CUSTOM_PROVIDER_QUERY_KEY] })
    },
  })
}

const customUpdate = (id: string) => {
  const qc = getQueryClient()

  return mutationOptions({
    mutationFn: async (reqBody: CustomProviderDto) => {
      const res = await services.providers.customUpdate(id, reqBody)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [PROVIDER_QUERY_KEY] })
      qc.invalidateQueries({ queryKey: [CUSTOM_PROVIDER_QUERY_KEY] })
    },
  })
}

const customDelete = () => {
  const qc = getQueryClient()

  return mutationOptions({
    mutationFn: async (id: string) => {
      const res = await services.providers.customDelete(id)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [PROVIDER_QUERY_KEY] })
      qc.invalidateQueries({ queryKey: [CUSTOM_PROVIDER_QUERY_KEY] })
    },
  })
}

export const providerQueries = {
  list,
  customList,
  customGet,
  customCreate,
  customUpdate,
  customDelete,
} as const
