import { env } from '@/config/env'
import { AUTH_STORAGE_KEYS } from '@/lib/constants/auth'

import type { CliToolResources } from './types/cli-tool'

import { ClientFetchApi } from '../client-fetch'
import { ApplyClaudeCodeSchema } from '../dtos/cli-tool/schema'
import { parseDto } from '../dtos/parse'

const path = '/v1/cli-tools'

const api = new ClientFetchApi({
  baseURL: String(env.VITE_API_URL),
  storageKey: AUTH_STORAGE_KEYS.AUTH_STORAGE,
}).default

const resources = (): CliToolResources => {
  return {
    claudeCode: () => {
      const url = `${path}/claude-code`
      return api.get(url)
    },
    /** writes ~/.claude/settings.json on the server host (audit-logged) */
    applyClaudeCode: (payload) => {
      const url = `${path}/claude-code/apply`
      return api.post(url, parseDto(ApplyClaudeCodeSchema, payload))
    },
  }
}

export const cliToolServices = resources()
