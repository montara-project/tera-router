export type BudgetScopeKind = 'tenant' | 'api_key' | 'account'

/** Matches the models.Budget json shape returned by GET /v1/budgets. */
export type Budget = {
  id: string
  scope_kind: BudgetScopeKind
  scope_id: string
  limit_micros: number
  limit_tokens: number
  period: 'daily' | 'weekly' | 'monthly'
  alert_pct: number
  hard_cutoff: boolean
  remaining_tokens: number
  remaining_micros: number
  period_bucket: string
  created_at: string
  updated_at: string
}

/** One row of GET /v1/budgets/status: budget plus current-period spend. */
export type BudgetStatus = Budget & {
  spent_micros: number
  spent_tokens: number
  spend_pct: number
  token_pct: number
}
