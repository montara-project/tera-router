import type { AxiosItemResponse } from '@/types/api'

/** How an OAuth flow completes after the user approves access.
 * - `paste_code`: the popup ends on the provider's display-code page
 *   (Anthropic) and the user pastes the shown code through the exchange
 *   endpoint.
 * - `loopback`: the provider redirects to the server's fixed loopback listener
 *   (Codex). A dashboard served from that same machine waits for the
 *   listener's postMessage; otherwise the user pastes the callback URL from
 *   the popup's address bar. */
export type OAuthCompletion = 'paste_code' | 'loopback'

export type OAuthAuthorizeResponse = {
  authorize_url: string
  state: string
  redirect_uri: string
  completion: OAuthCompletion
}

export type OAuthExchangeResponse = {
  id: string
  provider: string
  email: string
}

export type OAuthResources = {
  authorize: (provider: string) => Promise<AxiosItemResponse<OAuthAuthorizeResponse>>
  exchange: (
    provider: string,
    payload: { code: string; state: string }
  ) => Promise<AxiosItemResponse<OAuthExchangeResponse>>
}
