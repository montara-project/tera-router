import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'

import { toastAxiosError } from '@/lib/api/axios-error'
import { ACCOUNT_QUERY_KEY } from '@/lib/api/queries/account'
import { PROVIDER_QUERY_KEY } from '@/lib/api/queries/provider'
import { services } from '@/lib/api/services'

/** Source marker the backend's loopback callback page reports with (Codex). */
export const OAUTH_MESSAGE_SOURCE = 'tera-router-oauth'

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

/** Loopback hostnames the dashboard can be served from: only there does the
 * browser share the machine with the server's Codex callback listener. */
const isLoopbackHost = (hostname: string): boolean =>
  hostname === 'localhost' ||
  hostname === '127.0.0.1' ||
  hostname === '::1' ||
  hostname === '[::1]' ||
  hostname.endsWith('.localhost')

/** Accepts the pasted completion input in every shape it arrives: Anthropic's
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
 * `paste_code` opens the paste dialog (the popup stays open for the user to
 * copy from) and finishes through the exchange endpoint; `loopback` waits for
 * the server listener's postMessage when the dashboard runs on that same
 * machine, and otherwise falls back to pasting the callback URL.
 */
export function useOAuthConnect() {
  const queryClient = useQueryClient()
  const [connecting, setConnecting] = useState<string | null>(null)
  const [pasteFlow, setPasteFlow] = useState<PasteFlow | null>(null)
  const [pastePending, setPastePending] = useState(false)

  const connect = async (provider: string, name: string) => {
    setConnecting(provider)
    // A paste flow hands control to the dialog, so `connecting` must survive
    // this function's finally until the dialog resolves or cancels.
    let paste = false
    try {
      const res = await services.oauth.authorize(provider)
      const { authorize_url, state, completion } = res.data.data

      const popup = window.open(authorize_url, 'tera-oauth', 'width=560,height=760,popup=yes')
      if (!popup) {
        toast.error('Popup blocked — allow popups for this site and try again.')
        return
      }

      if (completion === 'paste_code') {
        paste = true
        setPasteFlow({ provider, name, state, popup, mode: 'code' })
        return
      }

      // Codex's loopback listener only reports back to a browser on the same
      // machine; a remotely-served dashboard must paste the callback URL.
      if (!isLoopbackHost(window.location.hostname)) {
        paste = true
        setPasteFlow({ provider, name, state, popup, mode: 'url' })
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
        toast.success(`${name} connected`)
      }
    } catch (error) {
      toastAxiosError(error)
    } finally {
      if (!paste) {
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
