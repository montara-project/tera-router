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
  /** Form-level endpoint override; folded into metadata.base_url on submit. */
  base_url: optionalString('base url'),
  priority: optionalNumber('priority'),
  proxy_pool_id: optionalString('proxy pool'),
  disabled: optionalBoolean('disabled'),
}) satisfies z.ZodType<AccountPayload>

export type AccountDto = z.infer<typeof AccountSchema>
