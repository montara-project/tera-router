import { env } from '@/config/env'
import { AUTH_STORAGE_KEYS } from '@/lib/constants/auth'

import type { GuardrailsResources } from './types/guardrails'

import { ClientFetchApi } from '../client-fetch'
import { EvaluateSchema, PolicySchema, SettingsSchema } from '../dtos/guardrails/schema'
import { parseDto } from '../dtos/parse'

const path = '/v1/guardrails'

const api = new ClientFetchApi({
  baseURL: String(env.VITE_API_URL),
  storageKey: AUTH_STORAGE_KEYS.AUTH_STORAGE,
}).default

const resources = (): GuardrailsResources => {
  return {
    /** settings toggle + policies + recent guardrail audit trail */
    overview: () => {
      const url = path
      return api.get(url)
    },
    store: (payload) => {
      const url = path
      return api.post(url, parseDto(PolicySchema, payload))
    },
    update: (id, payload) => {
      const url = `${path}/${id}`
      return api.patch(url, parseDto(PolicySchema, payload))
    },
    remove: (id) => {
      const url = `${path}/${id}`
      return api.delete(url)
    },
    /** tenant-wide external detector engines toggle */
    updateSettings: (payload) => {
      const url = `${path}/settings`
      return api.put(url, parseDto(SettingsSchema, payload))
    },
    /** dry-run sample text against a detector config (or the merged policies) */
    evaluate: (payload) => {
      const url = `${path}/evaluate`
      return api.post(url, parseDto(EvaluateSchema, payload))
    },
  }
}

export const guardrailsServices = resources()
