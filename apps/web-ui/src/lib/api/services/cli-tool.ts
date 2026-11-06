import { env } from '@/config/env'
import { AUTH_STORAGE_KEYS } from '@/lib/constants/auth'

import type { CliToolResources } from './types/cli-tool'

import { ClientFetchApi } from '../client-fetch'
import { ApplyCliToolSchema } from '../dtos/cli-tool/schema'
import { parseDto } from '../dtos/parse'

const path = '/v1/cli-tools'

const api = new ClientFetchApi({
  baseURL: String(env.VITE_API_URL),
  storageKey: AUTH_STORAGE_KEYS.AUTH_STORAGE,
}).default

const resources = (): CliToolResources => {
  return {
    /** which supported tools are installed on the server host */
    list: () => api.get(path),
    get: (id, params) => {
      const url = `${path}/${id}`
      return api.get(url, { params })
    },
    /** writes the tool's config files on the server host (audit-logged) */
    apply: (id, payload) => {
      const url = `${path}/${id}/apply`
      return api.post(url, parseDto(ApplyCliToolSchema, payload))
    },
  }
}

export const cliToolServices = resources()
