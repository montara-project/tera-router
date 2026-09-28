import { z } from 'zod'

import { optionalBoolean, optionalNumber, optionalString } from '@/lib/validation'

import type { Budget, BudgetScopeKind } from '../../models/budget'

import { enumValues } from '../enum'

const SCOPE_KINDS = enumValues<BudgetScopeKind>({ tenant: true, api_key: true, account: true })

/**
 * The server takes spend in USD and stores micros, so budget_spend has no
 * direct counterpart on the Budget model (which exposes limit_micros).
 */
type BudgetPayload = Partial<
  Pick<Budget, 'scope_kind' | 'scope_id' | 'limit_tokens' | 'period' | 'alert_pct' | 'hard_cutoff'>
> & { budget_spend?: number }

/** Budget create/update body (POST/PUT/PATCH /v1/budgets). */
export const BudgetSchema = z.object({
  scope_kind: z.enum(SCOPE_KINDS, { error: 'The selected scope kind is invalid.' }).optional(),
  scope_id: optionalString('scope id'),
  budget_spend: z.number({ error: 'The budget spend must be a number.' }).optional(),
  limit_tokens: optionalNumber('limit tokens'),
  period: z
    .enum(['daily', 'weekly', 'monthly'], { error: 'The selected period is invalid.' })
    .optional(),
  alert_pct: optionalNumber('alert percent'),
  hard_cutoff: optionalBoolean('hard cutoff'),
}) satisfies z.ZodType<BudgetPayload>

export type BudgetDto = z.infer<typeof BudgetSchema>
