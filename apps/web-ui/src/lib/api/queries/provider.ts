import { mutationOptions, queryOptions } from '@tanstack/react-query'

import type { ApiItemResponse } from '@/types/api'

import { getQueryClient } from '@/lib/providers/react-query'

import type { PaginateDto } from '../dtos/paginate'
import type { CustomProviderDto } from '../dtos/provider/schema'
import type { Models } from '../models'

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

export const GET_CUSTOM_PROVIDER_MODELS_QUERY_KEY = (id: string) => {
  return [CUSTOM_PROVIDER_QUERY_KEY, 'models', id]
}

export const GET_PROVIDER_MODELS_QUERY_KEY = (slug: string) => {
  return [PROVIDER_QUERY_KEY, 'models', slug]
}

export type ProviderModelListParams = PaginateDto & {
  search?: string
  /** Server-side state filter — narrows before paging, so pickers pass 'active'. */
  state?: Models.ProviderModelState
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

// Stored catalog with per-model states; search and paging are server-side,
// so the params are part of the cache key.
const customModels = (id: string, params?: ProviderModelListParams) =>
  queryOptions({
    queryKey: [...GET_CUSTOM_PROVIDER_MODELS_QUERY_KEY(id), params ?? {}],
    queryFn: async () => {
      const res = await services.providers.customModels(id, params)
      return res.data
    },
  })

const customModelsSync = (id: string) => {
  const qc = getQueryClient()

  return mutationOptions({
    mutationFn: async () => {
      const res = await services.providers.customModelsSync(id)
      return res.data
    },
    onSuccess: () => {
      // Refetch whichever page of the catalog is on screen.
      qc.invalidateQueries({ queryKey: GET_CUSTOM_PROVIDER_MODELS_QUERY_KEY(id) })
    },
  })
}

// Optimistic active/disabled toggle: apply to every cached page of the
// catalog, then refetch on settle (and on failure) so the UI never lies.
const customModelsUpdate = (id: string) => {
  const qc = getQueryClient()

  return mutationOptions({
    mutationFn: async (reqBody: { models: { id: string; state: Models.ProviderModelState }[] }) => {
      const res = await services.providers.customModelsUpdate(id, reqBody)
      return res.data
    },
    onMutate: async (reqBody) => {
      await qc.cancelQueries({ queryKey: GET_CUSTOM_PROVIDER_MODELS_QUERY_KEY(id) })
      const next = new Map(reqBody.models.map((u) => [u.id, u.state]))
      qc.setQueriesData<ApiItemResponse<Models.UpstreamModels>>(
        { queryKey: GET_CUSTOM_PROVIDER_MODELS_QUERY_KEY(id) },
        (old) => {
          if (!old) return old
          return {
            ...old,
            data: {
              ...old.data,
              models: old.data.models.map((m) =>
                next.has(m.id) ? { ...m, state: next.get(m.id)! } : m
              ),
            },
          }
        }
      )
    },
    onError: () => {
      qc.invalidateQueries({ queryKey: GET_CUSTOM_PROVIDER_MODELS_QUERY_KEY(id) })
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: GET_CUSTOM_PROVIDER_MODELS_QUERY_KEY(id) })
    },
  })
}

// Catalog-provider counterparts of customModels/customModelsSync/
// customModelsUpdate: same payloads, keyed by the provider slug.
const catalogModels = (slug: string, params?: ProviderModelListParams) =>
  queryOptions({
    queryKey: [...GET_PROVIDER_MODELS_QUERY_KEY(slug), params ?? {}],
    queryFn: async () => {
      const res = await services.providers.modelsList(slug, params)
      return res.data
    },
  })

const catalogModelsSync = (slug: string) => {
  const qc = getQueryClient()

  return mutationOptions({
    mutationFn: async () => {
      const res = await services.providers.modelsSync(slug)
      return res.data
    },
    onSuccess: () => {
      // Refetch whichever page of the catalog is on screen.
      qc.invalidateQueries({ queryKey: GET_PROVIDER_MODELS_QUERY_KEY(slug) })
    },
  })
}

const catalogModelsUpdate = (slug: string) => {
  const qc = getQueryClient()

  return mutationOptions({
    mutationFn: async (reqBody: { models: { id: string; state: Models.ProviderModelState }[] }) => {
      const res = await services.providers.modelsUpdate(slug, reqBody)
      return res.data
    },
    onMutate: async (reqBody) => {
      await qc.cancelQueries({ queryKey: GET_PROVIDER_MODELS_QUERY_KEY(slug) })
      const next = new Map(reqBody.models.map((u) => [u.id, u.state]))
      qc.setQueriesData<ApiItemResponse<Models.UpstreamModels>>(
        { queryKey: GET_PROVIDER_MODELS_QUERY_KEY(slug) },
        (old) => {
          if (!old) return old
          return {
            ...old,
            data: {
              ...old.data,
              models: old.data.models.map((m) =>
                next.has(m.id) ? { ...m, state: next.get(m.id)! } : m
              ),
            },
          }
        }
      )
    },
    onError: () => {
      qc.invalidateQueries({ queryKey: GET_PROVIDER_MODELS_QUERY_KEY(slug) })
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: GET_PROVIDER_MODELS_QUERY_KEY(slug) })
    },
  })
}

// One-shot model test for catalog and custom providers. A test changes no
// server state, so there is nothing to invalidate — the playground renders
// the result (or the upstream error) inline.
const catalogModelTest = (slug: string) =>
  mutationOptions({
    mutationFn: async (reqBody: { model: string; messages: Models.ModelTestMessage[] }) => {
      const res = await services.providers.modelsTest(slug, reqBody)
      return res.data
    },
  })

const customModelTest = (id: string) =>
  mutationOptions({
    mutationFn: async (reqBody: { model: string; messages: Models.ModelTestMessage[] }) => {
      const res = await services.providers.customModelsTest(id, reqBody)
      return res.data
    },
  })

export const providerQueries = {
  list,
  customList,
  customGet,
  customCreate,
  customUpdate,
  customDelete,
  customModels,
  customModelsSync,
  customModelsUpdate,
  catalogModels,
  catalogModelsSync,
  catalogModelsUpdate,
  catalogModelTest,
  customModelTest,
} as const
