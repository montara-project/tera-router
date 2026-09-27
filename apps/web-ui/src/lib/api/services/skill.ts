import type { AxiosDeleteResponse, AxiosItemResponse, AxiosListResponse } from '@/types/api'

import { env } from '@/config/env'
import { AUTH_STORAGE_KEYS } from '@/lib/constants/auth'

import type { CreateSkillDto } from '../dtos/skill/schema'
import type { Skill } from '../models/skill'

import { ClientFetchApi } from '../client-fetch'

const path = '/v1/skills'

const api = new ClientFetchApi({
  baseURL: String(env.VITE_API_URL),
  storageKey: AUTH_STORAGE_KEYS.AUTH_STORAGE,
}).default

function list(): Promise<AxiosListResponse<Skill>> {
  return api.get(path)
}

function store(payload: CreateSkillDto): Promise<AxiosItemResponse<Skill>> {
  return api.post(path, payload)
}

function remove(id: string): Promise<AxiosDeleteResponse> {
  return api.delete(`${path}/${id}`)
}

export const skillServices = {
  path,
  list,
  store,
  remove,
}
