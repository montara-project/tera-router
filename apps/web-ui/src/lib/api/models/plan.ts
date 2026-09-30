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
  alert_at_percent: number
  period: string
  created_at?: string
}
