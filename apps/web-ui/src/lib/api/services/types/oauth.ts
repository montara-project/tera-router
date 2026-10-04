import type { AxiosItemResponse, AxiosListResponse } from '@/types/api'

export type OAuthFlowInfo = {
  provider: string
  flow: string
  callback_path?: string
  fixed_port?: number
  loopback_host?: string
}

/** How an OAuth flow completes after the user approves access.
 * - `redirect`: the provider calls the dashboard callback back directly.
 * - `paste_code`: the popup ends on the provider's display-code page (Claude)
 *   and the user pastes the shown code through the exchange endpoint.
 * - `paste_callback_url`: the loopback redirect only lands on the machine
 *   running the browser, so a remotely-served dashboard collects the callback
 *   URL from the popup's address bar (Codex). */
export type OAuthCompletion = 'redirect' | 'paste_code' | 'paste_callback_url'

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
  providers: () => Promise<AxiosListResponse<OAuthFlowInfo>>
  authorize: (
    provider: string,
    redirectURI: string
  ) => Promise<AxiosItemResponse<OAuthAuthorizeResponse>>
  exchange: (
    provider: string,
    payload: { code: string; state: string; label?: string }
  ) => Promise<AxiosItemResponse<OAuthExchangeResponse>>
}
