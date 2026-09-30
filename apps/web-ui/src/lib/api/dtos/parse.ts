import { z } from 'zod'

/**
 * Validate one API request payload against its DTO schema.
 *
 * Every request body the web UI sends is validated here before it leaves the
 * browser, so an invalid payload fails with a readable field message instead
 * of a server round trip. The parsed value is returned so callers send the
 * narrowed, defaulted data.
 *
 * @param schema request DTO schema
 * @param payload request body
 * @returns the parsed payload
 */
export function parseDto<S extends z.ZodType>(schema: S, payload: unknown): z.output<S> {
  const result = schema.safeParse(payload)

  if (!result.success) {
    const messages = result.error.issues.map((issue) => issue.message).join('\n')
    throw new Error(`Validation failed:\n${messages}`)
  }

  return result.data
}
