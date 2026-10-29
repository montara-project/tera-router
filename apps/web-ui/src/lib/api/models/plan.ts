export type Plan = {
  id: string
  name: string
  description: string
  /** true renders the red "hard cutoff" badge */
  hard_cutoff: boolean
  /** null renders "Unlimited" */
  budget_spend: number | null
  budget_tokens: number | null
  rpm: number | null
  tpm: number | null
  concurrent: number | null
  /** null renders "All models allowed" */
  allowed_models: string[] | null
  keys_assigned: number
  /** each assigned key's spend this period; empty when the plan has no caps */
  key_usage: PlanKeyUsage[]
  alert_at_percent: number
  period: string
  created_at?: string
}

/** One key's spend against its plan's per-key caps over the current period. */
export type PlanKeyUsage = {
  id: string
  name: string
  spent_micros: number
  spent_tokens: number
  spend_pct: number
  token_pct: number
}
