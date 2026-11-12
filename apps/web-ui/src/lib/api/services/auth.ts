import { env } from '@/config/env'
import { AUTH_STORAGE_KEYS } from '@/lib/constants/auth'

import type { RefreshDto, SignInDto } from '../dtos/auth/schema'
import type { AuthResources } from './types/auth'

import { ClientFetchApi } from '../client-fetch'
import { ReauthSchema } from '../dtos/auth/schema'
import { parseDto } from '../dtos/parse'

const path = `/v1/auth`

const api = new ClientFetchApi({
  baseURL: String(env.API_URL),
  storageKey: AUTH_STORAGE_KEYS.AUTH_STORAGE,
}).default

const resources = (): AuthResources => {
  return {
    signIn: (reqBody: SignInDto) => {
      const url = `${path}/sign-in`
      return api.post(url, reqBody)
    },
    signInWithGoogle: () => {
      const url = `${path}/google/redirect`
      return api.get(url)
    },
    profile: () => {
      const url = `${path}/me`
      return api.get(url)
    },
    refresh: (reqBody: RefreshDto) => {
      const url = `${path}/refresh`
      return api.post(url, reqBody)
    },
    signOut: () => {
      const url = `${path}/sign-out`
      return api.post(url)
    },
    totpSetup: () => {
      const url = `${path}/totp/setup`
      return api.post(url)
    },
    totpEnable: (reqBody) => {
      const url = `${path}/totp/enable`
      return api.post(url, reqBody)
    },
    totpDisable: (reqBody) => {
      const url = `${path}/totp/disable`
      return api.post(url, reqBody)
    },
    sessions: () => {
      const url = `${path}/sessions`
      return api.get(url)
    },
    revokeSession: (id) => {
      const url = `${path}/sessions/${id}`
      return api.delete(url)
    },
    passkeys: () => {
      const url = `${path}/passkeys`
      return api.get(url)
    },
    passkeyRegisterBegin: (reqBody) => {
      const url = `${path}/passkeys/register/begin`
      return api.post(url, parseDto(ReauthSchema, reqBody))
    },
    passkeyRegisterFinish: (reqBody) => {
      const url = `${path}/passkeys/register/finish`
      return api.post(url, reqBody)
    },
    deletePasskey: (id) => {
      const url = `${path}/passkeys/${id}`
      return api.delete(url)
    },
    passkeySignInBegin: () => {
      const url = `${path}/passkey/begin`
      return api.post(url)
    },
    passkeySignInFinish: (reqBody) => {
      const url = `${path}/passkey/finish`
      return api.post(url, reqBody)
    },
    ssoConfig: () => {
      const url = `${path}/oidc/config`
      return api.get(url)
    },
    ssoExchange: (reqBody) => {
      const url = `${path}/oidc/exchange`
      return api.post(url, reqBody)
    },
    ssoVerifyTotp: (reqBody) => {
      const url = `${path}/oidc/verify-totp`
      return api.post(url, reqBody)
    },
  }
}

export const authServices = resources()
