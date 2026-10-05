import { z } from 'zod'

import { optionalString } from '@/lib/validation'

/** Configuration export body (POST /v1/backup/config/export). */
export const ConfigExportSchema = z.object({
  passphrase: optionalString('passphrase'),
})

export type ConfigExportDto = z.infer<typeof ConfigExportSchema>

/** Configuration import body (POST /v1/backup/config/import). */
export const ConfigImportSchema = z.object({
  passphrase: optionalString('passphrase'),
  backup: z.record(z.string(), z.unknown(), { error: 'The backup must be a JSON object.' }),
})

export type ConfigImportDto = z.infer<typeof ConfigImportSchema>

/** 9router / OmniRoute backup document, sent as-is (POST /v1/import/:source). */
export const LegacyBackupSchema = z.record(z.string(), z.unknown(), {
  error: 'The backup must be a JSON object.',
})

export type LegacyBackupDto = z.infer<typeof LegacyBackupSchema>
