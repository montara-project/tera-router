import { z } from 'zod'

import { optionalBoolean, optionalNumber, optionalString, requiredString } from '@/lib/validation'

import type { Chain, ChainStep } from '../../models/chain'

/** Steps carry only the routing coordinates; ids and positions are server-assigned. */
type ChainStepPayload = Pick<ChainStep, 'provider' | 'model'>

type ChainPayload = Partial<
  Pick<
    Chain,
    'name' | 'strategy' | 'fallback_provider' | 'fallback_model' | 'context_window' | 'enabled'
  >
> & { steps?: ChainStepPayload[] }

/** One ordered fallback target inside a chain. */
export const ChainStepSchema = z.object({
  provider: requiredString('provider'),
  model: requiredString('model'),
}) satisfies z.ZodType<ChainStepPayload>

/** Chain create/update body (POST/PUT/PATCH /v1/chains). */
export const ChainSchema = z.object({
  name: requiredString('name'),
  strategy: optionalString('strategy'),
  fallback_provider: optionalString('fallback provider'),
  fallback_model: optionalString('fallback model'),
  context_window: optionalNumber('context window'),
  enabled: optionalBoolean('enabled'),
  steps: z.array(ChainStepSchema, { error: 'The steps field must be an array.' }).optional(),
}) satisfies z.ZodType<ChainPayload>

export type ChainStepDto = z.infer<typeof ChainStepSchema>
export type ChainDto = z.infer<typeof ChainSchema>
