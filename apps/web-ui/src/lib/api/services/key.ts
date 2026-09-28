import { env } from '@/config/env'
import { AUTH_STORAGE_KEYS } from '@/lib/constants/auth'

import type { KeyResources } from './types/key'

import { ClientFetchApi } from '../client-fetch'
import { CreateKeySchema, UpdateKeySchema } from '../dtos/key/schema'
import { parseDto } from '../dtos/parse'

const path = '/v1/keys'

const api = new ClientFetchApi({
  baseURL: String(env.VITE_API_URL),
  storageKey: AUTH_STORAGE_KEYS.AUTH_STORAGE,
}).default

const resources = (): KeyResources => {
  return {
    list: (params) => {
      const url = path
      return api.get(url, { params })
    },
    store: (payload) => {
      const url = path
      // The server requires a name; default one when the caller omits it.
      return api.post(url, parseDto(CreateKeySchema, { name: 'New Key', ...payload }))
    },
    /** enable/disable a key (PATCH /v1/keys/:id) */
    toggleStatus: (id, disabled) => {
      const url = `${path}/${id}`
      return api.patch(url, parseDto(UpdateKeySchema, { disabled }))
    },
    remove: (id) => {
      const url = `${path}/${id}`
      return api.delete(url)
    },
    /** decrypts the stored key plaintext (audit-logged on the server) */
    reveal: (id) => {
      const url = `${path}/${id}/reveal`
      return api.post(url)
    },
  }
}

export const keyServices = resources()
