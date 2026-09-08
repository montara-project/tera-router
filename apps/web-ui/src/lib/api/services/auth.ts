import { env } from '@/config/env'
import { AUTH_STORAGE_KEYS } from '@/lib/constants/auth'

import type { RefreshDto, SignInDto } from '../dtos/auth/schema'
import type { AuthResources } from './types/auth'

import { ClientFetchApi } from '../client-fetch'

const path = `/v1/auth`

const api = new ClientFetchApi({
  baseURL: String(env.VITE_API_URL),
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
  }
}

export const authServices = resources()
