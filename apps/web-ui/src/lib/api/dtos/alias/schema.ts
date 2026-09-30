import { z } from 'zod'

import { optionalBoolean, optionalNumber, requiredString } from '@/lib/validation'

import type { AliasTarget, ModelAlias } from '../../models/provider-catalog'

/** Targets carry only the routing coordinates; ids and positions are server-assigned. */
type AliasTargetPayload = Pick<AliasTarget, 'provider' | 'model'> & { active?: boolean }

type AliasPayload = Pick<ModelAlias, 'name'> &
  Partial<Pick<ModelAlias, 'context_window' | 'active'>> & {
    targets: AliasTargetPayload[]
  }

/** One ordered candidate inside an alias pool. */
export const AliasTargetSchema = z.object({
  provider: requiredString('provider'),
  model: requiredString('model'),
  active: optionalBoolean('active'),
}) satisfies z.ZodType<AliasTargetPayload>

/**
 * Model alias pool upsert body (PUT /v1/models/alias). Writes replace the
 * whole pool: name, targets, and active flag together.
 */
export const AliasSchema = z.object({
  name: requiredString('name'),
  context_window: optionalNumber('context window'),
  active: optionalBoolean('active'),
  targets: z.array(AliasTargetSchema, { error: 'The targets field must be an array.' }),
}) satisfies z.ZodType<AliasPayload>

export type AliasTargetDto = z.infer<typeof AliasTargetSchema>
export type AliasDto = z.infer<typeof AliasSchema>
