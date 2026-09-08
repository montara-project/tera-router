import type { ISO8601DateString } from '@/types/time'

export interface SignInResponse {
  uid: string
  display_name: string
  email: string
  access_token: string
  refresh_token: string
  id_token: string
  expires_at: ISO8601DateString
  expires_in: number
  role: string
}

export type RefreshTokenResponse = SignInResponse
