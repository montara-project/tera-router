import { AxiosError } from 'axios'

import { throwAxiosError } from '../api/axios-error'
import { services } from '../api/services'
import { setAuthTokens } from './token-storage'

/** sessionStorage key for the browser-generated id that binds an SSO ticket
 * to the tab that began the sign-in. */
export const SSO_FLOW_KEY = 'sso_flow'

/** localStorage key the reauth callback's landing page parks the one-use
 * reauthentication ticket under. localStorage — not sessionStorage — because
 * the ceremony usually runs in a separate tab/popup while the pending action
 * waits in this one. The server page writes the same literal key. */
export const SSO_REAUTH_TICKET_KEY = 'sso_reauth_ticket'

/**
 * Take the ticket a fresh /oidc/reauth ceremony left for this browser. The
 * server accepts it once, so it is consumed from storage as it is read — the
 * next reauthentication needs a new ceremony.
 */
export function takeSSOReauthTicket(): string {
  const ticket = localStorage.getItem(SSO_REAUTH_TICKET_KEY) ?? ''
  localStorage.removeItem(SSO_REAUTH_TICKET_KEY)
  return ticket
}

/**
 * Send the browser through the step-up ceremony the reauth ticket comes
 * from. It opens in a popup so the pending action stays on screen; when
 * popups are blocked it navigates this tab instead — the ticket survives in
 * localStorage either way, and the action can be retried on return.
 */
export function startSSOReauth(apiURL: string) {
  const url = `${apiURL}/v1/auth/oidc/reauth`
  const popup = window.open(url, 'sso_reauth', 'popup,width=520,height=720')
  if (!popup) {
    window.location.href = url
  }
}

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

/**
 * Complete an SSO sign-in that stopped at the account's TOTP factor: the
 * callback held the verified identity pending, and a correct code opens the
 * session. Tokens are stored like a normal sign-in.
 */
export async function verifySSOTOTP(ticket: string, otp: string) {
  // Keep the flow until success: the server peeks the pending entry on a
  // wrong code, and the retry still has to repeat the same flow id.
  const flow = sessionStorage.getItem(SSO_FLOW_KEY) ?? undefined
  try {
    const res = await services.auth.ssoVerifyTotp({ ticket, otp, flow })
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
    sessionStorage.removeItem(SSO_FLOW_KEY)

    return payload
  } catch (error) {
    // A 401 is a wrong code, an expired pending ticket or a flow mismatch —
    // the client retries the code or starts the sign-in again.
    if (error instanceof AxiosError && error.response?.status === 401) {
      throw new Error('The code did not match, or the sign-in link expired. Try again.')
    }
    throwAxiosError(error as Error)
  }
}
