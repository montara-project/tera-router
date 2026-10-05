import { env } from '@/config/env'
import { AUTH_STORAGE_KEYS } from '@/lib/constants/auth'

import type { BackupResources } from './types/backup'

import { ClientFetchApi } from '../client-fetch'
import { ConfigExportSchema, ConfigImportSchema, LegacyBackupSchema } from '../dtos/backup/schema'
import { parseDto } from '../dtos/parse'

const path = '/v1/backup'

const api = new ClientFetchApi({
  baseURL: String(env.VITE_API_URL),
  storageKey: AUTH_STORAGE_KEYS.AUTH_STORAGE,
}).default

const resources = (): BackupResources => {
  return {
    databaseInfo: () => {
      const url = `${path}/database`
      return api.get(url)
    },
    downloadDatabase: () => {
      const url = `${path}/database/download`
      return api.get(url, { responseType: 'blob' })
    },
    restoreDatabase: (file) => {
      const url = `${path}/database/restore`
      const form = new FormData()
      form.append('file', file)
      return api.post(url, form)
    },
    exportConfig: (reqBody) => {
      const url = `${path}/config/export`
      return api.post(url, parseDto(ConfigExportSchema, reqBody), { responseType: 'blob' })
    },
    importConfig: (reqBody) => {
      const url = `${path}/config/import`
      return api.post(url, parseDto(ConfigImportSchema, reqBody))
    },
    importLegacy: (source, backup) => {
      const url = `/v1/import/${source}`
      return api.post(url, parseDto(LegacyBackupSchema, backup))
    },
  }
}

export const backupServices = resources()
