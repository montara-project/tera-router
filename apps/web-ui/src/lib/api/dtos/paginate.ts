import z from 'zod'

import { optionalNumber } from '@/lib/validation'

/** Shared offset/limit pagination query (GET list endpoints). */
export const PaginateSchema = z.object({
  offset: optionalNumber('offset'),
  limit: optionalNumber('limit'),
})

export type PaginateDto = z.infer<typeof PaginateSchema>
