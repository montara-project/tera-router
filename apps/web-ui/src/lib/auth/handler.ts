import { redirect } from '@tanstack/react-router'

import type { AuthSession } from '@/types/auth'

import { env } from '@/config/env'

import type { Models } from '../api/models'

import { AUTH_STORAGE_KEYS } from '../constants/auth'

/**
 * Read the session issued by our own backend.
 *
 * Tokens are stored in cookies (see `token-storage.ts`) so they are sent to
 * the server on every request. Both email/password and Google OAuth flows
 * store tokens the same way.
 */
async function getBackendSession(): Promise<AuthSession | null> {
  const accessToken = localStorage.getItem(AUTH_STORAGE_KEYS.ACCESS_TOKEN)
  const refreshToken = localStorage.getItem(AUTH_STORAGE_KEYS.REFRESH_TOKEN)
  const idToken = localStorage.getItem(AUTH_STORAGE_KEYS.ID_TOKEN)

  if (!accessToken) {
    return null
  }

  try {
    const res = await fetch(`${env.VITE_API_URL}/v1/auth/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    })

    if (!res.ok) {
      return null
    }

    const body = (await res.json()) as Record<string, unknown>
    const user: Models.User = (body?.data ?? body) as Models.User

    return {
      user,
      session: { token: accessToken },
      data: {
        accessToken,
        refreshToken: refreshToken!,
        idToken: idToken!,
        provider: 'custom' as const,
      },
    }
  } catch (error) {
    console.error('Backend session error:', (error as Error).message)
    return null
  }
}

/**
 * Require authentication and redirect to sign-in if not authenticated.
 */
export async function requireSession(): Promise<AuthSession> {
  const session = await getBackendSession()

  if (!session) {
    throw redirect({ to: '/' })
  }

  return session
}

/**
 * Get current session.
 * @returns Session object or null if not authenticated.
 */
export async function getSession(): Promise<AuthSession | null> {
  return getBackendSession()
}

/**
 * Redirect to `href` if the user is already authenticated.
 */
export async function redirectIfAuthenticated(href: string) {
  const session = await getBackendSession()

  if (session) {
    throw redirect({ to: href })
  }
}
