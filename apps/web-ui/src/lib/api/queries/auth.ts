import { mutationOptions, queryOptions } from '@tanstack/react-query'

import type { ReauthDto, ReauthResult } from '@/lib/api/dtos/auth/schema'
import type { Models } from '@/lib/api/models'

import { createPasskey } from '@/lib/auth/passkey'
import { getQueryClient } from '@/lib/providers/react-query'

import { services } from '../services'

export const AUTH_QUERY_KEY = 'auth'

export const ME_QUERY_KEY = () => {
  return [AUTH_QUERY_KEY, 'me']
}

const me = () =>
  queryOptions({
    queryKey: ME_QUERY_KEY(),
    queryFn: async () => {
      const res = await services.auth.profile()
      return res.data
    },
  })

const totpSetup = () =>
  mutationOptions({
    mutationFn: async () => {
      const res = await services.auth.totpSetup()
      return res.data
    },
  })

const totpEnable = () => {
  const qc = getQueryClient()

  return mutationOptions({
    mutationFn: async (reqBody: { secret: string; code: string }) => {
      const res = await services.auth.totpEnable(reqBody)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ME_QUERY_KEY() })
    },
  })
}

const totpDisable = () => {
  const qc = getQueryClient()

  return mutationOptions({
    mutationFn: async (reqBody: { code: string }) => {
      const res = await services.auth.totpDisable(reqBody)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ME_QUERY_KEY() })
    },
  })
}

export const SESSIONS_QUERY_KEY = () => {
  return [AUTH_QUERY_KEY, 'sessions']
}

const sessions = () =>
  queryOptions({
    queryKey: SESSIONS_QUERY_KEY(),
    queryFn: async () => {
      const res = await services.auth.sessions()
      return res.data
    },
  })

const revokeSession = () => {
  const qc = getQueryClient()

  return mutationOptions({
    mutationFn: async (id: string) => {
      const res = await services.auth.revokeSession(id)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: SESSIONS_QUERY_KEY() })
    },
  })
}

export const PASSKEYS_QUERY_KEY = () => {
  return [AUTH_QUERY_KEY, 'passkeys']
}

const passkeys = () =>
  queryOptions({
    queryKey: PASSKEYS_QUERY_KEY(),
    queryFn: async () => {
      const res = await services.auth.passkeys()
      return res.data
    },
  })

/**
 * Adds a passkey in one re-authenticated step: the server's begin call checks
 * the password (and TOTP), the browser creates the credential, the server
 * verifies and stores it.
 */
const addPasskey = () => {
  const qc = getQueryClient()

  return mutationOptions({
    mutationFn: async ({
      name,
      ...creds
    }: ReauthDto & { name: string }): Promise<ReauthResult<Models.Passkey>> => {
      const begin = (await services.auth.passkeyRegisterBegin(creds)).data.data
      if ('totp_required' in begin) return { totpRequired: true }
      const credential = await createPasskey(begin.options)
      const res = await services.auth.passkeyRegisterFinish({
        ceremony_id: begin.ceremony_id,
        name,
        credential,
      })
      return { value: res.data.data }
    },
    onSuccess: (res) => {
      if ('value' in res) qc.invalidateQueries({ queryKey: PASSKEYS_QUERY_KEY() })
    },
  })
}

const deletePasskey = () => {
  const qc = getQueryClient()

  return mutationOptions({
    mutationFn: async (id: string) => {
      const res = await services.auth.deletePasskey(id)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PASSKEYS_QUERY_KEY() })
    },
  })
}

export const authQueries = {
  me,
  totpSetup,
  totpEnable,
  totpDisable,
  sessions,
  revokeSession,
  passkeys,
  addPasskey,
  deletePasskey,
} as const
