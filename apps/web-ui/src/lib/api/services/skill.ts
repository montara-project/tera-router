import type { AxiosDeleteResponse, AxiosItemResponse, AxiosListResponse } from '@/types/api'

import type { CreateSkillDto } from '../dtos/skill/schema'
import type { Skill } from '../models/skill'

const path = '/v1/skills'

/**
 * The skills endpoint is not available on the server yet, so this service keeps
 * an in-memory skill list matching what GET /v1/skills would return.
 */
let skills: Skill[] = []

function list(): Promise<AxiosListResponse<Skill>> {
  const response = {
    data: {
      data: [...skills],
      metadata: { total: skills.length },
    },
  } as AxiosListResponse<Skill>

  return Promise.resolve(response)
}

function store(payload: CreateSkillDto): Promise<AxiosItemResponse<Skill>> {
  const skill: Skill = {
    id: crypto.randomUUID(),
    name: payload.name,
    description: payload.description ?? '',
    prompt: payload.prompt,
  }

  skills = [skill, ...skills]

  const response = {
    data: { data: skill, metadata: {}, message: 'Skill created' },
  } as AxiosItemResponse<Skill>

  return Promise.resolve(response)
}

function remove(id: string): Promise<AxiosDeleteResponse> {
  skills = skills.filter((skill) => skill.id !== id)

  const response = { data: { message: 'Skill deleted' } } as AxiosDeleteResponse

  return Promise.resolve(response)
}

export const skillServices = {
  path,
  list,
  store,
  remove,
}
