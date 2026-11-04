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

/** A begun passkey ceremony: send `options` to the browser, then finish with the id. */
export interface PasskeyCeremony<TOptions> {
  ceremony_id: string
  options: { publicKey: TOptions }
}

export interface PasskeyFinishDto {
  ceremony_id: string
  name?: string
  credential: ReturnType<PublicKeyCredential['toJSON']>
}

export interface TotpSetupResponse {
  secret: string
  otpauth_url: string
}
