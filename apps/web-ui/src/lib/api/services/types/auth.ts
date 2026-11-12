import type { AxiosItemResponse } from '@/types/api'

import type { RefreshDto, SignInDto } from '../../dtos/auth/schema'
import type { ReauthDto } from '../../dtos/auth/schema'
import type {
  PasskeyCeremony,
  PasskeyFinishDto,
  RefreshTokenResponse,
  SignInResponse,
  SSOConfigResponse,
  SSOExchangeDto,
  SSOVerifyTotpDto,
  TotpSetupResponse,
} from '../../dtos/auth/types'
import type { Models } from '../../models'

export type AuthResources = {
  signIn: (reqBody: SignInDto) => Promise<AxiosItemResponse<SignInResponse>>
  signInWithGoogle: () => Promise<AxiosItemResponse<{ targetURL: string }>>
  profile: () => Promise<AxiosItemResponse<Models.User>>
  refresh: (reqBody: RefreshDto) => Promise<AxiosItemResponse<RefreshTokenResponse>>
  signOut: () => Promise<AxiosItemResponse<void>>
  totpSetup: () => Promise<AxiosItemResponse<TotpSetupResponse>>
  totpEnable: (reqBody: {
    password: string
    secret: string
    code: string
    reauth_ticket?: string
  }) => Promise<AxiosItemResponse<void>>
  totpDisable: (reqBody: {
    password: string
    code: string
    reauth_ticket?: string
  }) => Promise<AxiosItemResponse<void>>
  sessions: () => Promise<AxiosItemResponse<Models.Session[]>>
  revokeSession: (id: string) => Promise<AxiosItemResponse<void>>
  passkeys: () => Promise<AxiosItemResponse<Models.Passkey[]>>
  passkeyRegisterBegin: (
    reqBody: ReauthDto
  ) => Promise<
    AxiosItemResponse<
      PasskeyCeremony<PublicKeyCredentialCreationOptionsJSON> | { totp_required: true }
    >
  >
  passkeyRegisterFinish: (reqBody: PasskeyFinishDto) => Promise<AxiosItemResponse<Models.Passkey>>
  deletePasskey: (id: string) => Promise<AxiosItemResponse<void>>
  passkeySignInBegin: () => Promise<
    AxiosItemResponse<PasskeyCeremony<PublicKeyCredentialRequestOptionsJSON>>
  >
  passkeySignInFinish: (reqBody: PasskeyFinishDto) => Promise<AxiosItemResponse<SignInResponse>>
  ssoConfig: () => Promise<AxiosItemResponse<SSOConfigResponse>>
  ssoExchange: (reqBody: SSOExchangeDto) => Promise<AxiosItemResponse<SignInResponse>>
  ssoVerifyTotp: (reqBody: SSOVerifyTotpDto) => Promise<AxiosItemResponse<SignInResponse>>
}
