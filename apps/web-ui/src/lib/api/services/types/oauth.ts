import type { AxiosItemResponse, AxiosListResponse } from '@/types/api'

export type OAuthFlowInfo = {
  provider: string
  flow: string
  callback_path?: string
  fixed_port?: number
  loopback_host?: string
}

export type OAuthAuthorizeResponse = {
  authorize_url: string
  state: string
  redirect_uri: string
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
