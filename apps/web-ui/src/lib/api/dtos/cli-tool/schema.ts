import { z } from 'zod'

import { optionalString, requiredString } from '@/lib/validation'

/**
 * Claude Code wiring body (POST /v1/cli-tools/claude-code/apply). The key is
 * sent by id; the server decrypts the plaintext and writes it itself.
 */
export const ApplyClaudeCodeSchema = z.object({
  base_url: requiredString('endpoint URL'),
  key_id: requiredString('API key'),
  model: optionalString('default model'),
})

export type ApplyClaudeCodeDto = z.infer<typeof ApplyClaudeCodeSchema>
