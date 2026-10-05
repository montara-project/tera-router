import { mutationOptions, queryOptions } from '@tanstack/react-query'

import { getQueryClient } from '@/lib/providers/react-query'

import type { EvaluateDto, GuardrailsSettingsDto, PolicyDto } from '../dtos/guardrails/schema'

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

/** Creates every policy in order; the list refreshes even when one fails midway. */
const importPolicies = () => {
  const qc = getQueryClient()

  return mutationOptions({
    mutationFn: async (policies: PolicyDto[]) => {
      for (const policy of policies) {
        await services.guardrails.store(policy)
      }
      return policies.length
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: [GUARDRAILS_QUERY_KEY] })
    },
  })
}

/** Dry-runs sample text against a draft detector config. */
const evaluate = () =>
  mutationOptions({
    mutationFn: async (reqBody: EvaluateDto) => {
      const res = await services.guardrails.evaluate(reqBody)
      return res.data
    },
  })

export const guardrailsQueries = {
  overview,
  create,
  update,
  delete: del,
  updateSettings,
  importPolicies,
  evaluate,
} as const
