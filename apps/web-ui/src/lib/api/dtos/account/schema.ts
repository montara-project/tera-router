import { z } from 'zod'

import {
  optionalBoolean,
  optionalNumber,
  optionalObject,
  optionalString,
  requiredString,
} from '@/lib/validation'

import type { Account, AccountAuthKind } from '../../models/account'

import { ReauthSchema } from '../auth/schema'
import { enumValues } from '../enum'

const AUTH_KINDS = enumValues<AccountAuthKind>({ api_key: true, oauth: true, none: true })

/**
 * Credential fields are write-only: they are sealed at rest by the server and
 * never returned, so they have no counterpart on the Account model.
 */
type AccountPayload = Pick<Account, 'provider'> &
  Partial<
    Pick<Account, 'label' | 'auth_kind' | 'metadata' | 'priority' | 'proxy_pool_id' | 'disabled'>
  > & {
    api_key?: string
    token?: string
    refresh?: string
  }

/** Account credential create/update body (POST/PUT/PATCH /v1/accounts). */
export const AccountSchema = z.object({
  provider: requiredString('provider'),
  label: optionalString('label'),
  auth_kind: z.enum(AUTH_KINDS, { error: 'The selected auth kind is invalid.' }).optional(),
  api_key: optionalString('api key'),
  token: optionalString('token'),
  refresh: optionalString('refresh token'),
  metadata: optionalObject('metadata'),
  /** Form-level endpoint override; folded into metadata.base_url on submit. */
  base_url: optionalString('base url'),
  priority: optionalNumber('priority'),
  proxy_pool_id: optionalString('proxy pool'),
  disabled: optionalBoolean('disabled'),
}) satisfies z.ZodType<AccountPayload>

export type AccountDto = z.infer<typeof AccountSchema>

/** Bulk add body (POST /v1/accounts/bulk): one API-key account per entry of api_keys. */
export const AccountBulkSchema = z.object({
  provider: requiredString('provider'),
  api_keys: z.array(z.string()).min(1, { error: 'Paste at least one API key.' }),
  label_prefix: optionalString('label prefix'),
  priority: optionalNumber('priority'),
})

export type AccountBulkDto = z.infer<typeof AccountBulkSchema>

/** Accounts export body (POST /v1/providers/:slug/accounts/export). */
export const AccountsExportSchema = ReauthSchema.extend({
  passphrase: requiredString('passphrase'),
})

export type AccountsExportDto = z.infer<typeof AccountsExportSchema>

/** Accounts import body (POST /v1/providers/:slug/accounts/import). */
export const AccountsImportSchema = z.object({
  passphrase: requiredString('passphrase'),
  backup: z.record(z.string(), z.unknown(), { error: 'The backup must be a JSON object.' }),
})

export type AccountsImportDto = z.infer<typeof AccountsImportSchema>
