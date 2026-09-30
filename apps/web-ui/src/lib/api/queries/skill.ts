import { mutationOptions, queryOptions } from '@tanstack/react-query'

import { getQueryClient } from '@/lib/providers/react-query'

import type { CreateSkillDto } from '../dtos/skill/schema'

import { services } from '../services'

export const SKILL_QUERY_KEY = 'skills'

export const LIST_SKILL_QUERY_KEY = () => {
  return [SKILL_QUERY_KEY, 'list']
}

const list = () =>
  queryOptions({
    queryKey: LIST_SKILL_QUERY_KEY(),
    queryFn: async () => {
      const res = await services.skills.list()
      return res.data
    },
  })

const create = () => {
  const qc = getQueryClient()

  return mutationOptions({
    mutationFn: async (reqBody: CreateSkillDto) => {
      const res = await services.skills.store(reqBody)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [SKILL_QUERY_KEY] })
    },
  })
}

const del = () => {
  const qc = getQueryClient()

  return mutationOptions({
    mutationFn: async (id: string) => {
      const res = await services.skills.remove(id)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [SKILL_QUERY_KEY] })
    },
  })
}

export const skillQueries = {
  list,
  create,
  delete: del,
} as const
