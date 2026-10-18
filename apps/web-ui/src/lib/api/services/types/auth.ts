import type { AxiosItemResponse } from '@/types/api'

import type { RefreshDto, SignInDto } from '../../dtos/auth/schema'
import type { RefreshTokenResponse, SignInResponse, TotpSetupResponse } from '../../dtos/auth/types'
import type { Models } from '../../models'

export type AuthResources = {
  signIn: (reqBody: SignInDto) => Promise<AxiosItemResponse<SignInResponse>>
  signInWithGoogle: () => Promise<AxiosItemResponse<{ targetURL: string }>>
  profile: () => Promise<AxiosItemResponse<Models.User>>
  refresh: (reqBody: RefreshDto) => Promise<AxiosItemResponse<RefreshTokenResponse>>
  signOut: () => Promise<AxiosItemResponse<void>>
  totpSetup: () => Promise<AxiosItemResponse<TotpSetupResponse>>
  totpEnable: (reqBody: { secret: string; code: string }) => Promise<AxiosItemResponse<void>>
  totpDisable: (reqBody: { code: string }) => Promise<AxiosItemResponse<void>>
}
