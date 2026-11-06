import { z } from 'zod'

import { optionalString, requiredString } from '@/lib/validation'

/**
 * POST /v1/cli-tools/:id/apply. Send key_name to create a dedicated key for
 * the tool, or api_key to use a full key the user pasted.
 */
export const ApplyCliToolSchema = z.object({
  base_url: requiredString('endpoint URL'),
  model: optionalString('default model'),
  key_name: optionalString('key name'),
  api_key: optionalString('API key'),
})

export type ApplyCliToolDto = z.infer<typeof ApplyCliToolSchema>
