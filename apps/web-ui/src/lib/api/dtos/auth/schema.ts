import z from 'zod'

import { requiredString } from '@/lib/validation'

export const SignInSchema = z
  .object({
    email: requiredString('email'),
    password: requiredString('password'),
  })
  .required()

export const RefreshSchema = z
  .object({
    refresh_token: requiredString('refresh_token'),
  })
  .required()

export type SignInDto = z.infer<typeof SignInSchema>
export type RefreshDto = z.infer<typeof RefreshSchema>
