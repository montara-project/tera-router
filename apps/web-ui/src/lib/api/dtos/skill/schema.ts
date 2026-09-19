import z from 'zod'

import { requiredString } from '@/lib/validation'

export const CreateSkillSchema = z.object({
  name: requiredString('name'),
  description: z.string(),
  prompt: requiredString('prompt'),
})

export type CreateSkillDto = z.infer<typeof CreateSkillSchema>
