/** The live database file (GET /v1/backup/database). */
export type DatabaseInfo = {
  driver: 'sqlite'
  path: string
  size_bytes: number
  schema_version: number
}

/** Result of restoring an uploaded .db file. */
export type DatabaseRestoreResult = {
  schema_version: number
  restored_schema_version: number
  safety_copy: string
}

/** Result of importing a Tera Router configuration backup: rows per table. */
export type ConfigImportResult = {
  tables: Record<string, number>
  safety_copy: string
}

export type LegacyImportSource = '9router' | 'omniroute'

export type LegacyImportSkipped = {
  kind: string
  name: string
  reason: string
}

/** Result of importing a 9router / OmniRoute backup. */
export type LegacyImportResult = {
  source: LegacyImportSource
  created: Record<string, number>
  skipped: LegacyImportSkipped[]
}
