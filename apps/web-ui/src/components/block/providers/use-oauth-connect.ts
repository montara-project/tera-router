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
 * loopback listener for Codex and the SPA /callback route for Claude). */
export const OAUTH_MESSAGE_SOURCE = 'tera-router-oauth'

// Where the started flow's provider is stashed so /callback can complete the
// exchange — the provider's redirect carries only the code and state.
const PROVIDER_STORAGE_KEY = 'tera-oauth-provider'

/** A flow the provider cannot redirect back to the dashboard: the popup ends
 * on the provider's display-code page and the user pastes the code instead. */
interface PasteFlow {
  provider: string
  name: string
  state: string
  popup: Window
}

// Slugs driving the OAuth flows: claude/codex are the subscription tiles,
// anthropic/openai the dual-auth catalog tiles running the same flows.
const oauthProviderName = (slug: string) =>
  OAUTH_PROVIDERS[slug] ?? DUAL_AUTH_PROVIDERS[slug]?.name ?? slug

/**
 * Drives one OAuth connect flow: asks the server for the authorize URL and
 * opens it in a popup. Codex completes via the backend's loopback listener
 * reporting success through postMessage; Claude's OAuth app cannot redirect
 * back to a deployed dashboard, so the popup ends on Anthropic's console page
 * showing an authorization code — the hook then opens the paste dialog and
 * finishes through the exchange endpoint.
 */
export function useOAuthConnect() {
  const queryClient = useQueryClient()
  const [connecting, setConnecting] = useState<string | null>(null)
  const [pasteFlow, setPasteFlow] = useState<PasteFlow | null>(null)
  const [pastePending, setPastePending] = useState(false)

  const connect = async (provider: string) => {
    setConnecting(provider)
    // A manual flow hands control to the paste dialog, so `connecting` must
    // survive this function's finally until the dialog resolves or cancels.
    let manual = false
    try {
      // The callback must follow the API origin: development splits dashboard
      // and API across ports, while the shipped image serves both from the
      // page origin (VITE_API_URL falls back to window.location.origin).
      const res = await services.oauth.authorize(provider, `${env.VITE_API_URL}/callback`)
      const { authorize_url, state, manual: displayCode } = res.data.data

      const popup = window.open(authorize_url, 'tera-oauth', 'width=560,height=760,popup=yes')
      if (!popup) {
        toast.error('Popup blocked — allow popups for this site and try again.')
        return
      }

      if (displayCode) {
        // The popup lands on the provider's display-code page; the flow
        // finishes in the paste dialog below.
        manual = true
        setPasteFlow({ provider, name: oauthProviderName(provider), state, popup })
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
        toast.success(`${provider} connected`)
      }
    } catch (error) {
      toastAxiosError(error)
    } finally {
      if (!manual) {
        sessionStorage.removeItem(PROVIDER_STORAGE_KEY)
        setConnecting(null)
      }
    }
  }

  const submitPasteCode = async (code: string) => {
    if (!pasteFlow) return
    setPastePending(true)
    try {
      await services.oauth.exchange(pasteFlow.provider, { code, state: pasteFlow.state })
      await queryClient.invalidateQueries({ queryKey: [ACCOUNT_QUERY_KEY] })
      await queryClient.invalidateQueries({ queryKey: [PROVIDER_QUERY_KEY] })
      toast.success(`${oauthProviderName(pasteFlow.provider)} connected`)
      pasteFlow.popup.close()
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
