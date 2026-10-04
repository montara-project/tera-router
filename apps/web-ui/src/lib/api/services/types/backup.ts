import type { AxiosResponse } from 'axios'

import type { AxiosItemResponse } from '@/types/api'

import type { ConfigExportDto, ConfigImportDto, LegacyBackupDto } from '../../dtos/backup/schema'
import type {
  ConfigImportResult,
  DatabaseInfo,
  DatabaseRestoreResult,
  LegacyImportResult,
  LegacyImportSource,
} from '../../models/backup'

export type BackupResources = {
  databaseInfo: () => Promise<AxiosItemResponse<DatabaseInfo>>
  downloadDatabase: () => Promise<AxiosResponse<Blob>>
  restoreDatabase: (file: File) => Promise<AxiosItemResponse<DatabaseRestoreResult>>
  exportConfig: (reqBody: ConfigExportDto) => Promise<AxiosResponse<Blob>>
  importConfig: (reqBody: ConfigImportDto) => Promise<AxiosItemResponse<ConfigImportResult>>
  importLegacy: (
    source: LegacyImportSource,
    backup: LegacyBackupDto
  ) => Promise<AxiosItemResponse<LegacyImportResult>>
}
