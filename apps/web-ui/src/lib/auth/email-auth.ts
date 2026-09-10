import { throwAxiosError } from '../api/axios-error'
import { services } from '../api/services'
import { setAuthTokens } from './token-storage'

interface SignInWithEmailParams {
  email: string
  password: string
}

/**
 * Authenticate against your own backend (NEXT_PUBLIC_API_URL) with email + password.
 * On success the returned tokens are stored and attached to subsequent API requests
 * by the axios interceptor in `client-fetch.ts`.
 */
export async function signInWithEmail({ email, password }: SignInWithEmailParams) {
  try {
    const res = await services.auth.signIn({ email, password })
    const payload = res?.data?.data

    if (!payload?.access_token) {
      throw new Error('Sign-in response did not include an access token')
    }

    setAuthTokens({
      accessToken: payload.access_token,
      refreshToken: payload.refresh_token,
      idToken: payload.id_token,
      expiresIn: payload.expires_in,
    })

    return res?.data
  } catch (error) {
    throwAxiosError(error as Error)
  }
}

export async function signInWithGoogle() {
  try {
    const res = await services.auth.signInWithGoogle()
    const payload = res?.data?.data

    return payload.targetURL
  } catch (error) {
    throwAxiosError(error as Error)
  }
}
