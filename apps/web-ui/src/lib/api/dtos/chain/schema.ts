import { z } from 'zod'

import { optionalBoolean, optionalNumber, optionalString, requiredString } from '@/lib/validation'

import type { Chain, ChainStep } from '../../models/chain'

/** Steps carry only the routing coordinates; ids and positions are server-assigned. */
type ChainStepPayload = Pick<ChainStep, 'provider' | 'model' | 'active'>

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
  active: z.boolean(),
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

/** Same rule as the server's dtos.ChainNamePattern. */
export const CHAIN_NAME_PATTERN = /^[A-Za-z0-9._-]+$/

const ChainTargetSchema = z.object({ provider: z.string(), model: z.string() })

/**
 * Values of the chain page form. The context window is typed as text (empty
 * means none), and the final fallback is a switch plus a target.
 */
export const ChainFormSchema = z
  .object({
    name: z
      .string()
      .trim()
      .nonempty('Add a chain name to continue.')
      .regex(CHAIN_NAME_PATTERN, 'Use only letters, numbers, dots, hyphens and underscores.'),
    strategy: z.string(),
    enabled: z.boolean(),
    context_window: z
      .string()
      .refine((v) => v.trim() === '' || /^\d+$/.test(v.trim()), 'Use a whole number of tokens.'),
    steps: z
      .array(ChainTargetSchema.extend({ active: z.boolean() }))
      .min(1, 'Add at least one model.'),
    fallback_on: z.boolean(),
    fallback: ChainTargetSchema,
  })
  .superRefine((v, ctx) => {
    if (v.steps.some((s) => !s.model)) {
      ctx.addIssue({ code: 'custom', path: ['steps'], message: 'Choose a model for every step.' })
    } else if (!v.steps.some((s) => s.active) && !v.fallback_on) {
      ctx.addIssue({
        code: 'custom',
        path: ['steps'],
        message: 'Turn on at least one step, or add a final fallback.',
      })
    }
    if (v.fallback_on && !v.fallback.model) {
      ctx.addIssue({
        code: 'custom',
        path: ['fallback'],
        message: 'Choose a final fallback model, or turn it off.',
      })
    }
  })

export type ChainFormValues = z.infer<typeof ChainFormSchema>
