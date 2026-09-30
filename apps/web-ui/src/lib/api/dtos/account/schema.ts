import { z } from 'zod'

import {
  optionalBoolean,
  optionalNumber,
  optionalObject,
  optionalString,
  requiredString,
} from '@/lib/validation'

import type { Account, AccountAuthKind } from '../../models/account'

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
  priority: optionalNumber('priority'),
  proxy_pool_id: optionalString('proxy pool'),
  disabled: optionalBoolean('disabled'),
}) satisfies z.ZodType<AccountPayload>

/** Bulk credential import body (POST /v1/accounts/bulk). */
export const BulkAccountsSchema = z.object({
  accounts: z
    .array(AccountSchema, { error: 'The accounts field must be an array.' })
    .min(1, 'The accounts field must not be empty.'),
}) satisfies z.ZodType<{ accounts: AccountPayload[] }>

/** Pre-save credential probe body (POST /v1/validate-key). */
export const ValidateKeySchema = z.object({
  provider: requiredString('provider'),
  api_key: requiredString('api key'),
  metadata: optionalObject('metadata'),
}) satisfies z.ZodType<{ provider: string; api_key: string; metadata?: Record<string, unknown> }>

export type AccountDto = z.infer<typeof AccountSchema>
export type BulkAccountsDto = z.infer<typeof BulkAccountsSchema>
export type ValidateKeyDto = z.infer<typeof ValidateKeySchema>
