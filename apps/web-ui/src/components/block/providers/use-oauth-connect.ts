import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'

import { DUAL_AUTH_PROVIDERS, OAUTH_PROVIDERS } from '@/components/block/providers/catalog-connect'
import { env } from '@/config/env'
import { toastAxiosError } from '@/lib/api/axios-error'
import { ACCOUNT_QUERY_KEY } from '@/lib/api/queries/account'
import { PROVIDER_QUERY_KEY } from '@/lib/api/queries/provider'
import { services } from '@/lib/api/services'

/** Source marker every OAuth callback page reports with (the backend's
 * loopback listener for Codex and the SPA /callback route). */
export const OAUTH_MESSAGE_SOURCE = 'tera-router-oauth'

// Where the started flow's provider is stashed so /callback can complete the
// exchange — the provider's redirect carries only the code and state.
const PROVIDER_STORAGE_KEY = 'tera-oauth-provider'

/** A flow whose popup cannot hand the code back to the dashboard: the user
 * pastes what the popup ends on (the provider's displayed code, or the
 * callback URL from its address bar) into the paste dialog. */
interface PasteFlow {
  provider: string
  name: string
  state: string
  popup: Window
  mode: 'code' | 'url'
}

// Slugs driving the OAuth flows: claude/codex are the subscription tiles,
// anthropic/openai the dual-auth catalog tiles running the same flows.
const oauthProviderName = (slug: string) =>
  OAUTH_PROVIDERS[slug] ?? DUAL_AUTH_PROVIDERS[slug]?.name ?? slug

/** Accepts the pasted completion input in every shape it arrives: Claude's
 * displayed `code#state`, a bare code, or a full callback URL (Codex's
 * loopback redirect lands on the browser's own machine, where the dashboard
 * can only read the address bar). Returns null when no code is extractable. */
const resolvePastedCode = (raw: string): { code: string; state?: string } | null => {
  const input = raw.trim()
  if (!input) return null
  if (!input.includes('://') && !/[?&]code=/.test(input)) {
    return { code: input }
  }
  try {
    const url = new URL(input)
    const code = url.searchParams.get('code')
    if (!code) return null
    return { code, state: url.searchParams.get('state') ?? undefined }
  } catch {
    return null
  }
}

/**
 * Drives one OAuth connect flow: asks the server for the authorize URL and
 * opens it in a popup. The authorize response decides how the flow completes:
 * `redirect` waits for the callback page's postMessage (the backend's loopback
 * listener or the SPA /callback route); `paste_code` and `paste_callback_url`
 * open the paste dialog — the popup stays open for the user to copy from —
 * and finish through the exchange endpoint.
 */
export function useOAuthConnect() {
  const queryClient = useQueryClient()
  const [connecting, setConnecting] = useState<string | null>(null)
  const [pasteFlow, setPasteFlow] = useState<PasteFlow | null>(null)
  const [pastePending, setPastePending] = useState(false)

  const connect = async (provider: string) => {
    setConnecting(provider)
    // A paste flow hands control to the dialog, so `connecting` must survive
    // this function's finally until the dialog resolves or cancels.
    let paste = false
    try {
      // The callback must follow the API origin: development splits dashboard
      // and API across ports, while the shipped image serves both from the
      // page origin (VITE_API_URL falls back to window.location.origin).
      const res = await services.oauth.authorize(provider, `${env.VITE_API_URL}/callback`)
      const { authorize_url, state, completion } = res.data.data

      const popup = window.open(authorize_url, 'tera-oauth', 'width=560,height=760,popup=yes')
      if (!popup) {
        toast.error('Popup blocked — allow popups for this site and try again.')
        return
      }

      const mode =
        completion === 'paste_code' ? 'code' : completion === 'paste_callback_url' ? 'url' : null
      if (mode) {
        paste = true
        setPasteFlow({ provider, name: oauthProviderName(provider), state, popup, mode })
        return
      }

      sessionStorage.setItem(PROVIDER_STORAGE_KEY, provider)

      const succeeded = await new Promise<boolean>((resolve) => {
        const finish = (result: boolean) => {
          window.removeEventListener('message', handler)
          window.clearInterval(poll)
          resolve(result)
        }
        const handler = (event: MessageEvent) => {
          const data = event.data as { source?: string; status?: string; message?: string }
          if (data?.source !== OAUTH_MESSAGE_SOURCE) return
          if (data.status === 'success') {
            finish(true)
          } else {
            toast.error(data.message || 'Sign-in failed')
            finish(false)
          }
        }
        window.addEventListener('message', handler)
        // Popup closed by the user (or silently closed by the provider) — the
        // flow died, stop waiting.
        const poll = window.setInterval(() => {
          if (popup.closed) {
            finish(false)
          }
        }, 500)
      })

      if (succeeded) {
        await queryClient.invalidateQueries({ queryKey: [ACCOUNT_QUERY_KEY] })
        await queryClient.invalidateQueries({ queryKey: [PROVIDER_QUERY_KEY] })
        toast.success(`${oauthProviderName(provider)} connected`)
      }
    } catch (error) {
      toastAxiosError(error)
    } finally {
      if (!paste) {
        sessionStorage.removeItem(PROVIDER_STORAGE_KEY)
        setConnecting(null)
      }
    }
  }

  const submitPasteCode = async (raw: string) => {
    const flow = pasteFlow
    if (!flow) return
    const parsed = resolvePastedCode(raw)
    if (!parsed) {
      toast.error(
        flow.mode === 'url'
          ? "No authorization code in that input — paste the full URL from the popup's address bar."
          : 'Paste the authorization code shown in the popup.'
      )
      return
    }
    setPastePending(true)
    try {
      await services.oauth.exchange(flow.provider, {
        code: parsed.code,
        state: parsed.state ?? flow.state,
      })
      await queryClient.invalidateQueries({ queryKey: [ACCOUNT_QUERY_KEY] })
      await queryClient.invalidateQueries({ queryKey: [PROVIDER_QUERY_KEY] })
      toast.success(`${flow.name} connected`)
      flow.popup.close()
      setPasteFlow(null)
      setConnecting(null)
    } catch (error) {
      toastAxiosError(error)
    } finally {
      setPastePending(false)
    }
  }

  const cancelPaste = () => {
    pasteFlow?.popup.close()
    setPasteFlow(null)
    setConnecting(null)
  }

  return { connect, connecting, pasteFlow, pastePending, submitPasteCode, cancelPaste }
}
