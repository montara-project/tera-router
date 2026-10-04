import { keepPreviousData, mutationOptions, queryOptions } from '@tanstack/react-query'

import { getQueryClient } from '@/lib/providers/react-query'

import type { CapabilityDto, PricingDto, PricingListDto } from '../dtos/override/schema'

import { services } from '../services'

export const OVERRIDE_QUERY_KEY = 'overrides'

/** Without params this is the prefix every pricing list page shares, so
 * mutations invalidate all pages at once. */
export const LIST_PRICING_OVERRIDE_QUERY_KEY = (params?: PricingListDto) => {
  const key: unknown[] = [OVERRIDE_QUERY_KEY, 'pricing', 'list']
  return params ? [...key, params] : key
}

export const LIST_CAPABILITY_OVERRIDE_QUERY_KEY = () => {
  return [OVERRIDE_QUERY_KEY, 'capability', 'list']
}

const pricingList = (params?: PricingListDto) =>
  queryOptions({
    queryKey: LIST_PRICING_OVERRIDE_QUERY_KEY(params),
    queryFn: async () => {
      const res = await services.overrides.pricingList(params)
      return res.data
    },
    // Keep the current page on screen while the next page or filter loads.
    placeholderData: keepPreviousData,
  })

const pricingUpsert = () => {
  const qc = getQueryClient()

  return mutationOptions({
    mutationFn: async (reqBody: PricingDto) => {
      const res = await services.overrides.pricingUpsert(reqBody)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: LIST_PRICING_OVERRIDE_QUERY_KEY() })
      // The provider rates snapshot merges overrides with the built-in catalog.
      qc.invalidateQueries({ queryKey: ['providers', 'rates'] })
    },
  })
}

const pricingDelete = () => {
  const qc = getQueryClient()

  return mutationOptions({
    mutationFn: async (reqBody: { provider: string; model?: string }) => {
      const res = await services.overrides.pricingDelete(reqBody.provider, reqBody.model)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: LIST_PRICING_OVERRIDE_QUERY_KEY() })
      qc.invalidateQueries({ queryKey: ['providers', 'rates'] })
    },
  })
}

const capabilityList = () =>
  queryOptions({
    queryKey: LIST_CAPABILITY_OVERRIDE_QUERY_KEY(),
    queryFn: async () => {
      const res = await services.overrides.capabilityList()
      return res.data
    },
  })

const capabilityPut = () => {
  const qc = getQueryClient()

  return mutationOptions({
    mutationFn: async (reqBody: CapabilityDto) => {
      const res = await services.overrides.capabilityPut(reqBody)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: LIST_CAPABILITY_OVERRIDE_QUERY_KEY() })
    },
  })
}

const capabilityDelete = () => {
  const qc = getQueryClient()

  return mutationOptions({
    mutationFn: async (reqBody: { provider: string; model: string }) => {
      const res = await services.overrides.capabilityDelete(reqBody.provider, reqBody.model)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: LIST_CAPABILITY_OVERRIDE_QUERY_KEY() })
    },
  })
}

const capabilityReset = () => {
  const qc = getQueryClient()

  return mutationOptions({
    mutationFn: async () => {
      const res = await services.overrides.capabilityReset()
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: LIST_CAPABILITY_OVERRIDE_QUERY_KEY() })
    },
  })
}

export const overrideQueries = {
  pricingList,
  pricingUpsert,
  pricingDelete,
  capabilityList,
  capabilityPut,
  capabilityDelete,
  capabilityReset,
} as const
