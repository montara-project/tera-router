import type { ISO8601DateString } from '@/types/time'

export interface SignInResponse {
  uid: string
  display_name: string
  email: string
  access_token: string
  refresh_token: string
  id_token: string
  expires_at: ISO8601DateString
  expires_in: number
  role: string
  /** Set instead of the tokens when the password is right but a TOTP code is needed. */
  totp_required?: boolean
}

export type RefreshTokenResponse = SignInResponse

export interface TotpSetupResponse {
  secret: string
  otpauth_url: string
}
