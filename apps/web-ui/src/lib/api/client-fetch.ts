import axios, { AxiosError, type AxiosInstance } from 'axios'

import { getAccessToken } from '../auth/auth-client'
import { clearAuthTokens } from '../auth/token-storage'
import { AUTH_STORAGE_KEYS } from '../constants/auth'
import { ms } from '../date'

const timeout = ms('5m')

/** Requests made while signing in; their 401 is a refused attempt, not an ended session. */
const SIGN_IN_ATTEMPT = /\/v1\/auth\/(sign-in|passkey\/(begin|finish)|oidc\/exchange)$/

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
  axiosInstance.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      if (error.code === 'ERR_NETWORK') {
        throw new Error('Network error')
      }

      // A sign-in attempt's 401 (wrong password, refused passkey) belongs to the
      // form: pass it on with the server's message. Any other 401 means the
      // session ended, so sign out and go to the login page.
      if (error.response?.status === 401 && !SIGN_IN_ATTEMPT.test(error.config?.url ?? '')) {
        if (storageKey === AUTH_STORAGE_KEYS.AUTH_STORAGE) {
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
