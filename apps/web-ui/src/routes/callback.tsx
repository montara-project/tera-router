import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'

import { services } from '@/lib/api/services'
import { getQueryClient } from '@/lib/providers/react-query'

export const Route = createFileRoute('/callback')({
  component: OAuthCallbackRoute,
})

/** Window that opened the sign-in popup; both the SPA and the backend's
 * loopback callback page report back with this message shape. */
const statusMessage = (status: 'success' | 'error', message: string) => ({
  source: 'tera-router-oauth',
  status,
  message,
})

// The provider that started the flow; the OAuth redirect carries only the
// code and state, so the starter stashes its provider here.
const PROVIDER_STORAGE_KEY = 'tera-oauth-provider'

function OAuthCallbackRoute() {
  const [status, setStatus] = useState<'working' | 'success' | 'error'>('working')
  const [message, setMessage] = useState('Completing sign-in…')
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true

    const run = async () => {
      const params = new URLSearchParams(window.location.search)
      const code = params.get('code') ?? ''
      const state = params.get('state') ?? ''
      const provider = sessionStorage.getItem(PROVIDER_STORAGE_KEY) ?? ''

      if (!code || !state || !provider) {
        setStatus('error')
        setMessage('Missing code, state, or provider — restart the sign-in flow.')
        return
      }

      try {
        const result = await services.oauth.exchange(provider, { code, state })
        // Prime the queries the dashboard will refetch on focus; the opener
        // invalidates again on its side.
        void getQueryClient().invalidateQueries({ queryKey: ['account'] })
        setStatus('success')
        const email = result.data.data.email
        setMessage(`Signed in${email ? ` as ${email}` : ''}.`)
        window.opener?.postMessage(statusMessage('success', ''), '*')
        setTimeout(() => window.close(), 800)
      } catch (error) {
        const detail = error instanceof Error ? error.message : 'Token exchange failed'
        setStatus('error')
        setMessage(detail)
        window.opener?.postMessage(statusMessage('error', detail), '*')
      } finally {
        sessionStorage.removeItem(PROVIDER_STORAGE_KEY)
      }
    }
    void run()
  }, [])

  const tone = status === 'success' ? '#22c55e' : status === 'error' ? '#ef4444' : '#fafafa'
  const title = status === 'success' ? 'Connected' : status === 'error' ? 'Sign-in failed' : 'Signing in…'

  return (
    <div
      style={{
        fontFamily: 'system-ui, sans-serif',
        display: 'grid',
        placeItems: 'center',
        height: '100vh',
        margin: 0,
        background: '#0a0a0a',
        color: '#fafafa',
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: 18, fontWeight: 600, color: status === 'working' ? '#fafafa' : tone }}>
          {title}
        </p>
        <p style={{ color: '#a1a1aa', fontSize: 14 }}>{message}</p>
        <p style={{ color: '#71717a', fontSize: 12 }}>You can close this window.</p>
      </div>
    </div>
  )
}
