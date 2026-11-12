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

/** GET /v1/auth/oidc/config — whether the server has dashboard SSO configured. */
export interface SSOConfigResponse {
  enabled: boolean
  /** Display name from OIDC_PROVIDER_NAME ("Pocket ID"), for the login button. */
  provider_name: string
}

/** POST /v1/auth/oidc/exchange body: the one-time ticket from the callback redirect. */
export interface SSOExchangeDto {
  ticket: string
  /** Repeats the id the SSO button generated, binding the ticket to this browser. */
  flow?: string
}

/** POST /v1/auth/oidc/verify-totp body: pending ticket + authenticator code. */
export interface SSOVerifyTotpDto {
  ticket: string
  otp: string
  /** Repeats the id the SSO button generated, binding the ticket to this browser. */
  flow?: string
}
