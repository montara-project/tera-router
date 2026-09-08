import { AUTH_STORAGE_KEYS } from '../constants/auth'

const isBrowser = typeof window !== 'undefined'

// Access/id tokens are short lived; refresh token needs to outlive them.
const DEFAULT_ACCESS_TOKEN_MAX_AGE = 60 * 60 // 1 hour
const REFRESH_TOKEN_MAX_AGE = 60 * 60 * 24 * 30 // 30 days

export interface AuthTokens {
  accessToken: string
  refreshToken?: string
  idToken?: string
  /** Access token lifetime in seconds, as returned by the backend (`expires_in`). */
  expiresIn?: number
}

function writeCookie(name: string, value: string, maxAgeSeconds: number) {
  if (!isBrowser) return

  const secure = window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax${secure}`
}

function readCookie(name: string): string | null {
  if (!isBrowser) return null

  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

function removeCookie(name: string) {
  if (!isBrowser) return

  document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`
}

/**
 * Persist backend-issued auth tokens in cookies so they are available both to the
 * browser (axios interceptor) and to the server (`getSession` in `handler.ts`).
 */
export function setAuthTokens({ accessToken, refreshToken, idToken, expiresIn }: AuthTokens) {
  const accessMaxAge = expiresIn ?? DEFAULT_ACCESS_TOKEN_MAX_AGE

  // Access Token
  writeCookie(AUTH_STORAGE_KEYS.ACCESS_TOKEN, accessToken, accessMaxAge)

  // Refresh Token
  if (refreshToken) {
    writeCookie(AUTH_STORAGE_KEYS.REFRESH_TOKEN, refreshToken, REFRESH_TOKEN_MAX_AGE)
  }

  // ID Token
  if (idToken) {
    writeCookie(AUTH_STORAGE_KEYS.ID_TOKEN, idToken, accessMaxAge)
  }
}

/**
 * Read the backend-issued access token from cookies (client-side).
 */
export function getStoredAccessToken(): string | null {
  return readCookie(AUTH_STORAGE_KEYS.ACCESS_TOKEN)
}

/**
 * Remove all backend-issued auth tokens from cookies.
 */
export function clearAuthTokens() {
  removeCookie(AUTH_STORAGE_KEYS.ACCESS_TOKEN)
  removeCookie(AUTH_STORAGE_KEYS.REFRESH_TOKEN)
  removeCookie(AUTH_STORAGE_KEYS.ID_TOKEN)
}
