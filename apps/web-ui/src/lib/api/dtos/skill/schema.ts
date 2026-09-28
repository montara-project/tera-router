import { z } from 'zod'

import { requiredString } from '@/lib/validation'

import type { Skill } from '../../models/skill'

/** Skill creation body (POST /v1/skills). */
export const CreateSkillSchema = z.object({
  name: requiredString('name'),
  description: z.string({ error: 'The description field must be a string.' }),
  prompt: requiredString('prompt'),
}) satisfies z.ZodType<Omit<Skill, 'id'>>

export type CreateSkillDto = z.infer<typeof CreateSkillSchema>
