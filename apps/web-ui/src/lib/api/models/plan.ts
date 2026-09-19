export type Plan = {
  id: string
  name: string
  description: string
  /** true renders the red "hard cutoff" badge */
  hardCutoff: boolean
  /** null renders "Unlimited" */
  budgetSpend: number | null
  budgetTokens: number | null
  rpm: number | null
  tpm: number | null
  concurrent: number | null
  /** null renders "All models allowed" */
  allowedModels: string[] | null
  keysAssigned: number
  alertAtPercent: number
}
