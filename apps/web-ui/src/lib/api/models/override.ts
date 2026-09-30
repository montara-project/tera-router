/** Matches the models.PricingOverride json shape (rates in micros). */
export type PricingOverride = {
  id: string
  provider: string
  model: string
  input_micros: number
  output_micros: number
  cache_read_micros: number
  cache_write_micros: number
  created_at: string
  updated_at: string
}

/** Matches the models.CapabilityOverride json shape. */
export type CapabilityOverride = {
  id: string
  provider: string
  model: string
  capabilities: string[]
  created_at: string
  updated_at: string
}
