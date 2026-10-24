import { z } from 'zod'

import {
  optionalBoolean,
  optionalString,
  optionalStringArray,
  requiredString,
} from '@/lib/validation'

/**
 * Key minting body (POST /v1/keys). The server mints the key material; only
 * the name is required.
 */
export const CreateKeySchema = z.object({
  name: requiredString('name'),
  plan_id: optionalString('plan'),
  scopes: optionalString('scopes'),
  allowed_models: optionalStringArray('allowed models'),
  skill_ids: optionalStringArray('skills'),
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
  allowed_models: optionalStringArray('allowed models'),
  skill_ids: optionalStringArray('skills'),
})

/**
 * Key reveal body (POST /v1/keys/:id/reveal): the signed-in user's password,
 * plus the authenticator code once the server answers totp_required.
 */
export const RevealKeySchema = z.object({
  password: requiredString('password'),
  otp: optionalString('authentication code'),
})

export type CreateKeyDto = z.infer<typeof CreateKeySchema>
export type UpdateKeyDto = z.infer<typeof UpdateKeySchema>
export type RevealKeyDto = z.infer<typeof RevealKeySchema>
