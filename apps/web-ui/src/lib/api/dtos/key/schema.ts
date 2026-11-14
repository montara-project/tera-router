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
import type { PaginateDto } from '../paginate'

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

export type CreateKeyDto = z.infer<typeof CreateKeySchema>
export type UpdateKeyDto = z.infer<typeof UpdateKeySchema>

const PERIODS = ['daily', 'weekly', 'monthly'] as const

/** Empty, or a number above 0. */
const optionalPositive = (message: string) =>
  z.string().refine((v) => v.trim() === '' || Number(v) > 0, message)

/** Empty, or a whole number above 0. */
const optionalWholePositive = (message: string) =>
  z.string().refine((v) => v.trim() === '' || (/^\d+$/.test(v.trim()) && Number(v) > 0), message)

/**
 * Values of the create-key dialog. Limits are typed as text so an empty field
 * means "no limit"; a USD or token limit becomes the key's own budget.
 */
export const KeyFormSchema = z
  .object({
    name: z.string().trim().nonempty('Name is required.'),
    /** "none" for no plan; Radix Select cannot hold an empty value. */
    plan_id: z.string(),
    limit_usd: optionalPositive('Limit (USD) must be more than 0.'),
    limit_tokens: optionalWholePositive('Limit (tokens) must be a whole number above 0.'),
    period: z.enum(PERIODS),
    models: z.array(z.string()),
    alert_pct: z.string(),
    hard_cutoff: z.boolean(),
  })
  .superRefine((v, ctx) => {
    const hasLimit = v.limit_usd.trim() !== '' || v.limit_tokens.trim() !== ''
    const alert = Number(v.alert_pct)
    if (hasLimit && !(Number.isInteger(alert) && alert >= 1 && alert <= 100)) {
      ctx.addIssue({
        code: 'custom',
        path: ['alert_pct'],
        message: 'Alert at must be between 1 and 100.',
      })
    }
  })

export type KeyFormValues = z.infer<typeof KeyFormSchema>

/** Query of GET /v1/keys: paging plus the search, status and sort the server
 * applies. */
export type KeyListDto = PaginateDto & {
  /** Matches the name, the key preview or the plan name. */
  search?: string
  status?: 'active' | 'disabled'
  sort?: 'newest' | 'oldest' | 'name'
}
