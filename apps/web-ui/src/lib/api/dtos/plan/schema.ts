import { z } from 'zod'

import { optionalBoolean, optionalNumber, optionalString } from '@/lib/validation'

import type { Plan } from '../../models/plan'

/** id, keysAssigned, and createdAt are server-owned and not writable. */
type PlanPayload = Partial<Omit<Plan, 'id' | 'keysAssigned' | 'createdAt'>>

/**
 * Plan create/update body (POST/PUT/PATCH /v1/plans). The server takes spend
 * in USD and stores micros; null renders "Unlimited" or "All models allowed".
 */
export const PlanSchema = z.object({
  name: optionalString('name'),
  description: optionalString('description'),
  budgetSpend: z.number({ error: 'The budget spend must be a number.' }).nullish(),
  budgetTokens: optionalNumber('budget tokens').nullish(),
  period: z
    .enum(['daily', 'weekly', 'monthly'], { error: 'The selected period is invalid.' })
    .optional(),
  alertAtPercent: optionalNumber('alert at percent'),
  hardCutoff: optionalBoolean('hard cutoff'),
  allowedModels: z
    .array(z.string({ error: 'The allowed models field must be an array.' }), {
      error: 'The allowed models field must be an array.',
    })
    .nullish(),
  rpm: optionalNumber('rpm').nullish(),
  tpm: optionalNumber('tpm').nullish(),
  concurrent: optionalNumber('concurrent').nullish(),
}) satisfies z.ZodType<PlanPayload>

export type PlanDto = z.infer<typeof PlanSchema>
