import type { AxiosResponse } from 'axios'

import { mutationOptions, queryOptions } from '@tanstack/react-query'
import { AxiosError } from 'axios'

import { getQueryClient } from '@/lib/providers/react-query'

import type { ReauthDto, ReauthResult } from '../dtos/auth/schema'
import type { ConfigExportDto, ConfigImportDto, LegacyBackupDto } from '../dtos/backup/schema'
import type { LegacyImportSource } from '../models/backup'

import { services } from '../services'

export const BACKUP_QUERY_KEY = 'backup'

export const DATABASE_BACKUP_QUERY_KEY = () => {
  return [BACKUP_QUERY_KEY, 'database']
}

/** A file the server sent for download, with the name to save it under. */
export type DownloadedFile = {
  blob: Blob
  filename: string
}

/** The server-suggested name (Content-Disposition), else `<prefix>-<ISO time>.<ext>`. */
function downloaded(res: AxiosResponse<Blob>, prefix: string, ext: string): DownloadedFile {
  const disposition = String(res.headers['content-disposition'] ?? '')
  const match = /filename="?([^";]+)"?/i.exec(disposition)
  const fallback = `${prefix}-${new Date().toISOString().replace(/[:.]/g, '-')}.${ext}`
  return { blob: res.data, filename: match?.[1] ?? fallback }
}

/**
 * Blob requests receive their error body as a Blob too; decode it back into
 * the JSON envelope so axiosErrorMessage can show the server's message.
 */
async function decodeBlobError(error: unknown): Promise<never> {
  if (error instanceof AxiosError && error.response?.data instanceof Blob) {
    try {
      error.response.data = JSON.parse(await error.response.data.text())
    } catch {
      // not JSON: keep the generic message
    }
  }
  throw error
}

const databaseInfo = () =>
  queryOptions({
    queryKey: DATABASE_BACKUP_QUERY_KEY(),
    queryFn: async () => {
      const res = await services.backup.databaseInfo()
      return res.data
    },
  })

/**
 * Backups re-authenticate: until the authenticator code is sent the server
 * answers with a JSON totp_required envelope instead of the file. The config
 * export is itself JSON, so only a body carrying that flag counts.
 */
async function fileOrTotp(
  res: AxiosResponse<Blob>,
  prefix: string,
  ext: string
): Promise<ReauthResult<DownloadedFile>> {
  if (String(res.headers['content-type'] ?? '').includes('application/json')) {
    try {
      const body = JSON.parse(await res.data.text())
      if (body?.data?.totp_required === true) return { totpRequired: true }
    } catch {
      // not an envelope: the file itself
    }
  }
  return { value: downloaded(res, prefix, ext) }
}

const downloadDatabase = () =>
  mutationOptions({
    mutationFn: async (reqBody: ReauthDto) => {
      const res = await services.backup.downloadDatabase(reqBody).catch(decodeBlobError)
      return fileOrTotp(res, 'terarouter', 'db')
    },
  })

const exportConfig = () =>
  mutationOptions({
    mutationFn: async (reqBody: ConfigExportDto) => {
      const res = await services.backup.exportConfig(reqBody).catch(decodeBlobError)
      return fileOrTotp(res, 'tera-router-config', 'json')
    },
  })

// Restores and imports rewrite most of the dataset, so every cached query
// is refetched afterwards.

const restoreDatabase = () => {
  const qc = getQueryClient()

  return mutationOptions({
    mutationFn: async (file: File) => {
      const res = await services.backup.restoreDatabase(file)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries()
    },
  })
}

const importConfig = () => {
  const qc = getQueryClient()

  return mutationOptions({
    mutationFn: async (reqBody: ConfigImportDto) => {
      const res = await services.backup.importConfig(reqBody)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries()
    },
  })
}

const importLegacy = () => {
  const qc = getQueryClient()

  return mutationOptions({
    mutationFn: async ({
      source,
      backup,
    }: {
      source: LegacyImportSource
      backup: LegacyBackupDto
    }) => {
      const res = await services.backup.importLegacy(source, backup)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries()
    },
  })
}

export const backupQueries = {
  databaseInfo,
  downloadDatabase,
  exportConfig,
  restoreDatabase,
  importConfig,
  importLegacy,
} as const
