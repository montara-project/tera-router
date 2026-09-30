import { z } from 'zod'

import { requiredNumber, requiredString } from '@/lib/validation'

import type { CapabilityOverride, PricingOverride } from '../../models/override'

type PricingPayload = Omit<PricingOverride, 'id' | 'created_at' | 'updated_at'>
type CapabilityPayload = Omit<CapabilityOverride, 'id' | 'created_at' | 'updated_at'>

/** Per-model pricing override upsert body (POST /v1/model-pricing-overrides). */
export const PricingSchema = z.object({
  provider: requiredString('provider'),
  model: requiredString('model'),
  input_micros: requiredNumber('input micros'),
  output_micros: requiredNumber('output micros'),
  cache_read_micros: requiredNumber('cache read micros'),
  cache_write_micros: requiredNumber('cache write micros'),
}) satisfies z.ZodType<PricingPayload>

/** Capability override upsert body (PUT /v1/capability-overrides). */
export const CapabilitySchema = z.object({
  provider: requiredString('provider'),
  model: requiredString('model'),
  capabilities: z.array(z.string({ error: 'The capabilities field must be an array.' }), {
    error: 'The capabilities field must be an array.',
  }),
}) satisfies z.ZodType<CapabilityPayload>

export type PricingDto = z.infer<typeof PricingSchema>
export type CapabilityDto = z.infer<typeof CapabilitySchema>
