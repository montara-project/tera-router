import { z } from 'zod'

import {
  optionalBoolean,
  optionalNumber,
  optionalObject,
  optionalString,
  requiredString,
} from '@/lib/validation'

import type { CustomProvider } from '../../models/provider-catalog'

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

export type CustomProviderDto = z.infer<typeof CustomProviderSchema>
