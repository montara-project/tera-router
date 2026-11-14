import { mutationOptions, queryOptions } from '@tanstack/react-query'

import type { ApiItemResponse } from '@/types/api'

import { getQueryClient } from '@/lib/providers/react-query'

import type { PaginateDto } from '../dtos/paginate'
import type { CustomProviderDto, ProviderRoutingDto } from '../dtos/provider/schema'
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

export const GET_PROVIDER_ROUTING_QUERY_KEY = (slug: string) => {
  return [PROVIDER_QUERY_KEY, 'routing', slug]
}

export const GET_CUSTOM_PROVIDER_QUERY_KEY = (id: string) => {
  return [CUSTOM_PROVIDER_QUERY_KEY, 'detail', id]
}

export const GET_CUSTOM_PROVIDER_MODELS_QUERY_KEY = (id: string) => {
  return [CUSTOM_PROVIDER_QUERY_KEY, 'models', id]
}

export const GET_CUSTOM_PROVIDER_BY_SLUG_QUERY_KEY = (slug: string) => {
  return [CUSTOM_PROVIDER_QUERY_KEY, 'by-slug', slug]
}

export const GET_PROVIDER_MODELS_QUERY_KEY = (slug: string) => {
  return [PROVIDER_QUERY_KEY, 'models', slug]
}

export type ProviderModelListParams = PaginateDto & {
  search?: string
  /** Server-side state filter — narrows before paging, so pickers pass 'active'. */
  state?: Models.ProviderModelState
}

/** The providers overview: whole, or narrowed and paged by the server when
 * `params` carries filters. */
const list = (params?: Models.ProvidersOverviewDto) =>
  queryOptions({
    queryKey: params ? [...LIST_PROVIDER_QUERY_KEY(), params] : LIST_PROVIDER_QUERY_KEY(),
    queryFn: async () => {
      const res = await services.providers.list(params)
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
      const res = await services.providers.customGet(id)
      return res.data.data
    },
  })

// Row-level lookups (pricing cells carry only the slug). A 404 just means the
// slug belongs to a catalog provider, not a transient failure — no retries.
const customGetBySlug = (slug: string) =>
  queryOptions({
    queryKey: GET_CUSTOM_PROVIDER_BY_SLUG_QUERY_KEY(slug),
    retry: false,
    queryFn: async () => {
      const res = await services.providers.customGetBySlug(slug)
      return res.data.data
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

const customBulkDelete = () => {
  const qc = getQueryClient()

  return mutationOptions({
    mutationFn: async (ids: string[]) => {
      const res = await services.providers.customBulkDelete(ids)
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

/** The list endpoints return at most this many models a page. */
const MODEL_PAGE_LIMIT = 100

/**
 * Every active model of a provider, for a picker. The server keeps the active
 * ones and pages them, so the pages are read in turn: a picker that stopped at
 * the first page offered only 100 models. `key` is the slug of a catalog
 * provider or the uuid of a custom one.
 */
const allActiveModels = (kind: 'catalog' | 'custom', key: string) =>
  queryOptions({
    queryKey: [
      ...(kind === 'catalog'
        ? GET_PROVIDER_MODELS_QUERY_KEY(key)
        : GET_CUSTOM_PROVIDER_MODELS_QUERY_KEY(key)),
      { state: 'active', all: true },
    ],
    queryFn: async () => {
      const read =
        kind === 'catalog' ? services.providers.modelsList : services.providers.customModels
      const first = (await read(key, { state: 'active', offset: 0, limit: MODEL_PAGE_LIMIT })).data
      const models = [...first.data.models]
      for (
        let offset = MODEL_PAGE_LIMIT;
        offset < (first.data.total ?? 0);
        offset += MODEL_PAGE_LIMIT
      ) {
        const page = (await read(key, { state: 'active', offset, limit: MODEL_PAGE_LIMIT })).data
        models.push(...page.data.models)
      }
      return { ...first, data: { ...first.data, models } }
    },
  })

const routing = (slug: string) =>
  queryOptions({
    queryKey: GET_PROVIDER_ROUTING_QUERY_KEY(slug),
    queryFn: async () => {
      const res = await services.providers.routing(slug)
      return res.data
    },
    enabled: !!slug,
  })

const updateRouting = (slug: string) => {
  const qc = getQueryClient()

  return mutationOptions({
    mutationFn: async (reqBody: ProviderRoutingDto) => {
      const res = await services.providers.updateRouting(slug, reqBody)
      return res.data
    },
    onSuccess: (res) => {
      qc.setQueryData(GET_PROVIDER_ROUTING_QUERY_KEY(slug), res)
    },
  })
}

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
type ModelTestStreamVars = {
  model: string
  messages: Models.ModelTestMessage[]
  onDelta: (text: string) => void
}

/** Streamed model test for a catalog provider; resolves with the final result. */
const catalogModelTest = (slug: string) =>
  mutationOptions({
    mutationFn: ({ onDelta, ...reqBody }: ModelTestStreamVars) =>
      services.providers.modelsTestStream(slug, reqBody, onDelta),
  })

/** Streamed model test for a custom provider; resolves with the final result. */
const customModelTest = (id: string) =>
  mutationOptions({
    mutationFn: ({ onDelta, ...reqBody }: ModelTestStreamVars) =>
      services.providers.customModelsTestStream(id, reqBody, onDelta),
  })

export const providerQueries = {
  allActiveModels,
  list,
  customList,
  customGet,
  customGetBySlug,
  customCreate,
  customUpdate,
  customDelete,
  customBulkDelete,
  customModels,
  customModelsSync,
  customModelsUpdate,
  catalogModels,
  routing,
  updateRouting,
  catalogModelsSync,
  catalogModelsUpdate,
  catalogModelTest,
  customModelTest,
} as const
