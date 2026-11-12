import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'

import BrandPanel from '@/components/block/auth/brand-panel'
import LoginSection from '@/components/block/auth/login-section'

export const Route = createFileRoute('/(auth)/(login)/')({
  // The OIDC callback lands back here carrying either a one-time ticket or an
  // error code from the server.
  validateSearch: (
    search: Record<string, unknown>
  ): { sso_ticket?: string; sso_totp?: string; sso_error?: string } => ({
    sso_ticket:
      typeof search.sso_ticket === 'string' && search.sso_ticket ? search.sso_ticket : undefined,
    sso_totp: typeof search.sso_totp === 'string' && search.sso_totp ? search.sso_totp : undefined,
    sso_error:
      typeof search.sso_error === 'string' && search.sso_error ? search.sso_error : undefined,
  }),
  component: RouteComponent,
})

function RouteComponent() {
  // The brand panel switches to the second-step copy while a TOTP code is due.
  const [twoFactorEmail, setTwoFactorEmail] = useState<string | null>(null)
  const { sso_ticket, sso_totp, sso_error } = Route.useSearch()

  return (
    <div className="flex min-h-svh bg-background">
      <BrandPanel
        twoFactorEmail={twoFactorEmail}
        className="hidden lg:flex lg:w-[480px] lg:shrink-0 xl:w-[600px]"
      />
      <main className="flex flex-1 items-center justify-center p-6 md:p-12">
        <LoginSection
          ssoTicket={sso_ticket}
          ssoTotp={sso_totp}
          ssoError={sso_error}
          onTwoFactorChange={setTwoFactorEmail}
        />
      </main>
    </div>
  )
}
