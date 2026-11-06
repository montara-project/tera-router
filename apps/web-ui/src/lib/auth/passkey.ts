import { AxiosError } from 'axios'

import { throwAxiosError } from '../api/axios-error'
import { services } from '../api/services'
import { setAuthTokens } from './token-storage'

/** Whether this browser can parse the server's WebAuthn JSON options. */
export function passkeysSupported() {
  return (
    typeof window !== 'undefined' &&
    typeof window.PublicKeyCredential?.parseCreationOptionsFromJSON === 'function' &&
    typeof window.PublicKeyCredential?.parseRequestOptionsFromJSON === 'function'
  )
}

function assertSupported() {
  if (!passkeysSupported()) throw new Error('This browser does not support passkeys.')
}

// The browser rejects with NotAllowedError for a cancel, a timeout and a
// missing passkey alike; say so instead of the generic DOMException text.
function browserError(error: unknown): never {
  if (error instanceof DOMException && error.name === 'NotAllowedError') {
    throw new Error('The passkey prompt was cancelled or timed out.')
  }
  throw error
}

/** Runs the browser's create-passkey prompt for the server's creation options. */
export async function createPasskey(options: {
  publicKey: PublicKeyCredentialCreationOptionsJSON
}) {
  assertSupported()
  const publicKey = PublicKeyCredential.parseCreationOptionsFromJSON(options.publicKey)
  const credential = await navigator.credentials.create({ publicKey }).catch(browserError)
  return (credential as PublicKeyCredential).toJSON()
}

/** Signs in with a passkey the user picks; stores the tokens like email sign-in. */
export async function signInWithPasskey() {
  assertSupported()
  try {
    const begin = (await services.auth.passkeySignInBegin()).data.data
    const publicKey = PublicKeyCredential.parseRequestOptionsFromJSON(begin.options.publicKey)
    const credential = await navigator.credentials.get({ publicKey }).catch(browserError)
    const res = await services.auth.passkeySignInFinish({
      ceremony_id: begin.ceremony_id,
      credential: (credential as PublicKeyCredential).toJSON(),
    })
    const payload = res.data.data
    setAuthTokens({
      accessToken: payload.access_token,
      refreshToken: payload.refresh_token,
      idToken: payload.id_token,
      expiresIn: payload.expires_in,
    })
    return payload
  } catch (error) {
    // The server answers every refused passkey with a bare 401 (expired
    // ceremony, unknown passkey, bad signature), so name what the user can do.
    if (error instanceof AxiosError && error.response?.status === 401) {
      throw new Error(
        'This passkey was not accepted. It may not be registered on this server, or the prompt took too long. Try again or sign in with your password.'
      )
    }
    throwAxiosError(error as Error)
  }
}
