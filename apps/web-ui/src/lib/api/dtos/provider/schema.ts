import { z } from 'zod'

import {
  optionalBoolean,
  optionalNumber,
  optionalObject,
  optionalString,
  requiredNumber,
  requiredString,
} from '@/lib/validation'

import type { CustomProvider } from '../../models/provider-catalog'

import { ACCOUNT_STRATEGIES, type ProviderRouting } from '../../models/provider'

/**
 * pricing and metadata travel as JSON objects on the wire; the CustomProvider
 * model exposes them as the raw JSON strings the server stores.
 */
type CustomProviderPayload = Pick<CustomProvider, 'name'> &
  Partial<Pick<CustomProvider, 'slug' | 'base_url' | 'api_kind' | 'enabled' | 'priority'>> & {
    pricing?: Record<string, unknown>
    metadata?: Record<string, unknown>
  }

/**
 * Custom OpenAI-compatible upstream registration body
 * (POST/PUT/PATCH /v1/custom-providers).
 */
export const CustomProviderSchema = z.object({
  name: requiredString('name'),
  slug: optionalString('slug'),
  base_url: optionalString('base url'),
  api_kind: optionalString('api kind'),
  pricing: optionalObject('pricing'),
  enabled: optionalBoolean('enabled'),
  priority: optionalNumber('priority'),
  metadata: optionalObject('metadata'),
}) satisfies z.ZodType<CustomProviderPayload>

/** Account strategy body (PUT /v1/providers/:id/routing). */
export const ProviderRoutingSchema = z.object({
  strategy: z.enum(ACCOUNT_STRATEGIES),
  sticky_limit: requiredNumber('requests before rotating').min(1).max(1000),
  affinity_hours: requiredNumber('session affinity').min(1).max(720),
}) satisfies z.ZodType<ProviderRouting>

export type CustomProviderDto = z.infer<typeof CustomProviderSchema>
export type ProviderRoutingDto = z.infer<typeof ProviderRoutingSchema>
