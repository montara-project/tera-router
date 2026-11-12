import z from 'zod'

import { optionalString, requiredString } from '@/lib/validation'

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

export type SignInDto = z.infer<typeof SignInSchema> & { otp?: string }
export type RefreshDto = z.infer<typeof RefreshSchema>

/**
 * Re-authentication body for actions that expose secrets (key reveal, backup
 * download and export): the signed-in user's password — empty is allowed
 * with a reauth_ticket a fresh /oidc/reauth ceremony minted — plus the
 * authenticator code once the server answers totp_required.
 */
export const ReauthSchema = z.object({
  password: optionalString('password'),
  otp: optionalString('authentication code'),
  reauth_ticket: optionalString('reauthentication ticket'),
})

export type ReauthDto = z.infer<typeof ReauthSchema>

/** Outcome of a re-authenticated call: its result, or a request for the TOTP code. */
export type ReauthResult<T> = { totpRequired: true } | { value: T }
