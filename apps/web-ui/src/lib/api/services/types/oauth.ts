import type { AxiosItemResponse } from '@/types/api'

/** How an OAuth flow completes after the user approves access.
 * - `paste_code`: the popup ends on the provider's display-code page
 *   (Anthropic) and the user pastes the shown code through the exchange
 *   endpoint.
 * - `loopback`: the provider redirects to the server's fixed loopback listener
 *   (Codex). A dashboard served from that same machine waits for the
 *   listener's postMessage; otherwise the user pastes the callback URL from
 *   the popup's address bar.
 * - `poll`: the server registered a device sign-in (ZCode) and the dashboard
 *   polls the poll endpoint with the returned state until it reports ready. */
export type OAuthCompletion = 'paste_code' | 'loopback' | 'poll'

export type OAuthAuthorizeResponse = {
  authorize_url: string
  state: string
  redirect_uri?: string
  completion: OAuthCompletion
  /** Seconds between poll attempts (device flows). */
  poll_interval_sec?: number
}

export type OAuthExchangeResponse = {
  id: string
  provider: string
  email: string
}

/** One step of a device sign-in: `pending` while the user has not approved. */
export type OAuthPollResponse = {
  status: 'pending' | 'ready'
  id?: string
  provider?: string
  email?: string
}

export type OAuthResources = {
  authorize: (provider: string) => Promise<AxiosItemResponse<OAuthAuthorizeResponse>>
  exchange: (
    provider: string,
    payload: { code: string; state: string }
  ) => Promise<AxiosItemResponse<OAuthExchangeResponse>>
  poll: (provider: string, state: string) => Promise<AxiosItemResponse<OAuthPollResponse>>
}
