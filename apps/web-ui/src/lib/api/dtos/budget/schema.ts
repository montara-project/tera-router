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

const SCOPE_NOUN: Record<BudgetScopeKind, string> = {
  tenant: '',
  api_key: 'key',
  account: 'account',
}

/**
 * Values of the budget dialog. Limits are typed as text: empty means
 * unlimited and is sent as 0, which the server stores as "no limit".
 */
export const BudgetFormSchema = z
  .object({
    scope_kind: z.enum(SCOPE_KINDS),
    scope_id: z.string(),
    period: z.enum(['daily', 'weekly', 'monthly']),
    spend: z
      .string()
      .refine((v) => v.trim() === '' || Number(v) > 0, 'Spend limit must be more than 0.'),
    tokens: z
      .string()
      .refine(
        (v) => v.trim() === '' || /^\d+$/.test(v.trim()),
        'Token limit must be a whole number.'
      ),
    alert_pct: z.string().refine((v) => {
      const n = Number(v)
      return Number.isInteger(n) && n >= 1 && n <= 100
    }, 'Alert at must be between 1 and 100.'),
    hard_cutoff: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.scope_kind !== 'tenant' && !v.scope_id) {
      ctx.addIssue({
        code: 'custom',
        path: ['scope_id'],
        message: `Pick the ${SCOPE_NOUN[v.scope_kind]} this budget applies to.`,
      })
    }
  })

export type BudgetFormValues = z.infer<typeof BudgetFormSchema>
