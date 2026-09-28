import { z } from 'zod'

import { optionalBoolean, optionalString, requiredString } from '@/lib/validation'

/**
 * Key minting body (POST /v1/keys). The server mints the key material; only
 * the name is required.
 */
export const CreateKeySchema = z.object({
  name: requiredString('name'),
  plan_id: optionalString('plan'),
  scopes: optionalString('scopes'),
})

/**
 * Key mutation body (PUT/PATCH /v1/keys/:id). Absent fields keep their
 * stored values; an empty plan_id clears the binding.
 */
export const UpdateKeySchema = z.object({
  name: optionalString('name'),
  plan_id: optionalString('plan'),
  scopes: optionalString('scopes'),
  disabled: optionalBoolean('disabled'),
})

export type CreateKeyDto = z.infer<typeof CreateKeySchema>
export type UpdateKeyDto = z.infer<typeof UpdateKeySchema>
