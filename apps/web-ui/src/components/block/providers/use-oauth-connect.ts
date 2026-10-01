import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'

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

/**
 * Drives one OAuth connect flow: asks the server for the authorize URL, opens
 * it in a popup, and resolves when the callback page (either the backend's
 * loopback listener for Codex or the SPA /callback route for Claude) reports
 * success via postMessage — or when the popup closes without reporting.
 */
export function useOAuthConnect() {
  const queryClient = useQueryClient()
  const [connecting, setConnecting] = useState<string | null>(null)

  const connect = async (provider: string) => {
    setConnecting(provider)
    try {
      const res = await services.oauth.authorize(provider, `${window.location.origin}/callback`)
      const authorizeURL = res.data.data.authorize_url

      sessionStorage.setItem(PROVIDER_STORAGE_KEY, provider)
      const popup = window.open(authorizeURL, 'tera-oauth', 'width=560,height=760,popup=yes')
      if (!popup) {
        toast.error('Popup blocked — allow popups for this site and try again.')
        return
      }

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
      sessionStorage.removeItem(PROVIDER_STORAGE_KEY)
      setConnecting(null)
    }
  }

  return { connect, connecting }
}
