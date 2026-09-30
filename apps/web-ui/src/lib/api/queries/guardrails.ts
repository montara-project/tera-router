import { mutationOptions, queryOptions } from '@tanstack/react-query'

import { getQueryClient } from '@/lib/providers/react-query'

import type { GuardrailsSettingsDto, PolicyDto } from '../dtos/guardrails/schema'

import { services } from '../services'

export const GUARDRAILS_QUERY_KEY = 'guardrails'

export const OVERVIEW_GUARDRAILS_QUERY_KEY = () => {
  return [GUARDRAILS_QUERY_KEY, 'overview']
}

const overview = () =>
  queryOptions({
    queryKey: OVERVIEW_GUARDRAILS_QUERY_KEY(),
    queryFn: async () => {
      const res = await services.guardrails.overview()
      return res.data
    },
  })

const create = () => {
  const qc = getQueryClient()

  return mutationOptions({
    mutationFn: async (reqBody: PolicyDto) => {
      const res = await services.guardrails.store(reqBody)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [GUARDRAILS_QUERY_KEY] })
    },
  })
}

const update = () => {
  const qc = getQueryClient()

  return mutationOptions({
    mutationFn: async ({ id, reqBody }: { id: string; reqBody: PolicyDto }) => {
      const res = await services.guardrails.update(id, reqBody)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [GUARDRAILS_QUERY_KEY] })
    },
  })
}

const del = () => {
  const qc = getQueryClient()

  return mutationOptions({
    mutationFn: async (id: string) => {
      const res = await services.guardrails.remove(id)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [GUARDRAILS_QUERY_KEY] })
    },
  })
}

const updateSettings = () => {
  const qc = getQueryClient()

  return mutationOptions({
    mutationFn: async (reqBody: GuardrailsSettingsDto) => {
      const res = await services.guardrails.updateSettings(reqBody)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [GUARDRAILS_QUERY_KEY] })
    },
  })
}

export const guardrailsQueries = {
  overview,
  create,
  update,
  delete: del,
  updateSettings,
} as const
