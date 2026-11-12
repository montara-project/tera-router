import { AxiosError } from 'axios'

import { throwAxiosError } from '../api/axios-error'
import { services } from '../api/services'
import { setAuthTokens } from './token-storage'

/** sessionStorage key for the browser-generated id that binds an SSO ticket
 * to the tab that began the sign-in. */
export const SSO_FLOW_KEY = 'sso_flow'

/**
 * Redeem the one-time ticket the OIDC callback appended to its redirect for
 * the session it opened; stores the tokens like email sign-in. The ticket is
 * single-use and lives for a minute, so a refresh cannot redeem it twice.
 * When the sign-in was begun with a flow id (the SSO button stores one), the
 * exchange must repeat it — a ticket leaked anywhere else cannot be redeemed.
 */
export async function signInWithSSOTicket(ticket: string) {
  const flow = sessionStorage.getItem(SSO_FLOW_KEY) ?? undefined
  sessionStorage.removeItem(SSO_FLOW_KEY)
  try {
    const res = await services.auth.ssoExchange({ ticket, flow })
    const payload = res?.data?.data

    if (!payload?.access_token) {
      throw new Error('Sign-in response did not include an access token')
    }

    setAuthTokens({
      accessToken: payload.access_token,
      refreshToken: payload.refresh_token,
      idToken: payload.id_token,
      expiresIn: payload.expires_in,
    })

    return payload
  } catch (error) {
    // A refused ticket is a bare 401: unknown, expired or already redeemed.
    if (error instanceof AxiosError && error.response?.status === 401) {
      throw new Error('The sign-in link expired or was already used. Try signing in again.')
    }
    throwAxiosError(error as Error)
  }
}
