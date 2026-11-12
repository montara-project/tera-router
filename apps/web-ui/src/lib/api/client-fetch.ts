import axios, { AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios'

import { getAccessToken } from '../auth/auth-client'
import { clearAuthTokens, getStoredRefreshToken, setAuthTokens } from '../auth/token-storage'
import { AUTH_STORAGE_KEYS } from '../constants/auth'
import { ms } from '../date'

const timeout = ms('5m')

/** Requests made while signing in; their 401 is a refused attempt, not an ended session. */
const SIGN_IN_ATTEMPT =
  /\/v1\/auth\/(sign-in|passkey\/(begin|finish)|oidc\/(exchange|verify-totp))$/

const REFRESH_PATH = '/v1/auth/refresh'

type RetriedConfig = InternalAxiosRequestConfig & { __authRetried?: boolean }

interface CreateAxiosProps {
  baseURL: string
  storageKey?: string
}

/**
 * Create axios instance
 * @param params
 * @returns
 */
function createAxios({ baseURL, storageKey }: CreateAxiosProps) {
  const axiosInstance = axios.create({ baseURL, timeout })

  // Interceptor Request
  if (storageKey) {
    axiosInstance.interceptors.request.use(async (config) => {
      const currentConfig = { ...config }

      const accessToken = await getAccessToken()

      // Check Session if exists
      if (accessToken) {
        try {
          currentConfig.headers.Authorization = `Bearer ${accessToken}`
        } catch (error) {
          console.error(error)
        }
      }

      return currentConfig
    })
  }

  // Interceptor Response
  // Concurrent 401s share one refresh: the server rotates the refresh token,
  // so a second call with the old one fails and signs everyone out.
  let refreshing: Promise<boolean> | null = null
  const refreshOnce = (): Promise<boolean> => {
    refreshing ??= (async () => {
      try {
        const refreshToken = getStoredRefreshToken()
        if (!refreshToken) return false
        const res = await axiosInstance.post(REFRESH_PATH, { refresh_token: refreshToken })
        const tokens = res.data?.data
        if (!tokens?.access_token) return false
        setAuthTokens({
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          idToken: tokens.id_token,
          expiresIn: tokens.expires_in,
        })
        return true
      } catch {
        return false
      } finally {
        refreshing = null
      }
    })()
    return refreshing
  }

  axiosInstance.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      if (error.code === 'ERR_NETWORK') {
        throw new Error('Network error')
      }

      // A sign-in attempt's 401 (wrong password, refused passkey) belongs to the
      // form: pass it on with the server's message. Any other 401 means the
      // access token expired: renew it with the refresh token and retry once.
      // Only a failed refresh, or a retry that still 401s, ends the session.
      const url = error.config?.url ?? ''
      if (error.response?.status === 401 && !SIGN_IN_ATTEMPT.test(url)) {
        if (storageKey === AUTH_STORAGE_KEYS.AUTH_STORAGE) {
          const config = error.config as RetriedConfig | undefined
          if (config && !config.__authRetried && url !== REFRESH_PATH && (await refreshOnce())) {
            config.__authRetried = true
            return axiosInstance.request(config)
          }
          clearAuthTokens()
          window.location.href = '/'
        }
        throw new Error('Unauthorized')
      }

      if (error.response?.status === 403) {
        throw new Error('Forbidden')
      }

      return Promise.reject(error)
    }
  )

  return axiosInstance
}

/**
 * Fetch API
 * @example
 * const fetchApi = new ClientFetchApi({ baseURL: 'https://api.example.com', storageKey: 'token' }).default
 * fetchApi.get('/users')
 */
export class ClientFetchApi {
  private _axiosInstance: AxiosInstance | null
  private readonly _baseURL: string
  private readonly _storageKey?: string

  constructor({ baseURL, storageKey }: CreateAxiosProps) {
    this._axiosInstance = null
    this._baseURL = baseURL
    this._storageKey = storageKey
  }

  public get default(): AxiosInstance {
    if (!this._axiosInstance) {
      this._axiosInstance = createAxios({
        baseURL: this._baseURL,
        storageKey: this._storageKey,
      })

      return this._axiosInstance
    }

    return this._axiosInstance
  }
}
