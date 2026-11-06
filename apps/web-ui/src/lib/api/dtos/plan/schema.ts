import { z } from 'zod'

import { optionalBoolean, optionalNumber, optionalString } from '@/lib/validation'

import type { Plan } from '../../models/plan'

/** id, keys_assigned, and created_at are server-owned and not writable. */
type PlanPayload = Partial<Omit<Plan, 'id' | 'keys_assigned' | 'created_at'>>

/**
 * Plan create/update body (POST/PUT/PATCH /v1/plans). The server takes spend
 * in USD and stores micros; null renders "Unlimited" or "All models allowed".
 */
export const PlanSchema = z.object({
  name: optionalString('name'),
  description: optionalString('description'),
  budget_spend: z.number({ error: 'The budget spend must be a number.' }).nullish(),
  budget_tokens: optionalNumber('budget tokens').nullish(),
  period: z
    .enum(['daily', 'weekly', 'monthly'], { error: 'The selected period is invalid.' })
    .optional(),
  alert_at_percent: optionalNumber('alert at percent'),
  hard_cutoff: optionalBoolean('hard cutoff'),
  allowed_models: z
    .array(z.string({ error: 'The allowed models field must be an array.' }), {
      error: 'The allowed models field must be an array.',
    })
    .nullish(),
  rpm: optionalNumber('rpm').nullish(),
  tpm: optionalNumber('tpm').nullish(),
  concurrent: optionalNumber('concurrent').nullish(),
}) satisfies z.ZodType<PlanPayload>

export type PlanDto = z.infer<typeof PlanSchema>

const optionalWhole = (label: string) =>
  z
    .string()
    .refine((v) => v.trim() === '' || /^\d+$/.test(v.trim()), `${label} must be a whole number.`)

/**
 * Values of the plan dialog. Limits are typed as text: empty means unlimited
 * and is sent as 0, which the server stores as "no limit".
 */
export const PlanFormSchema = z.object({
  name: z.string().trim().nonempty('Name is required.'),
  description: z.string(),
  period: z.enum(['daily', 'weekly', 'monthly']),
  spend: z
    .string()
    .refine((v) => v.trim() === '' || Number(v) > 0, 'Spend limit must be more than 0.'),
  tokens: optionalWhole('Token limit'),
  rpm: optionalWhole('Requests / min'),
  tpm: optionalWhole('Tokens / min'),
  concurrent: optionalWhole('Concurrent requests'),
  alert_pct: z.string().refine((v) => {
    const n = Number(v)
    return Number.isInteger(n) && n >= 1 && n <= 100
  }, 'Alert at must be between 1 and 100.'),
  hard_cutoff: z.boolean(),
  models: z.array(z.string()),
})

export type PlanFormValues = z.infer<typeof PlanFormSchema>
