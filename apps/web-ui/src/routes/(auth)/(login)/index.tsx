import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'

import BrandPanel from '@/components/block/auth/brand-panel'
import LoginSection from '@/components/block/auth/login-section'

export const Route = createFileRoute('/(auth)/(login)/')({
  component: RouteComponent,
})

function RouteComponent() {
  // The brand panel switches to the second-step copy while a TOTP code is due.
  const [twoFactorEmail, setTwoFactorEmail] = useState<string | null>(null)

  return (
    <div className="flex min-h-svh bg-background">
      <BrandPanel
        twoFactorEmail={twoFactorEmail}
        className="hidden lg:flex lg:w-[480px] lg:shrink-0 xl:w-[600px]"
      />
      <main className="flex flex-1 items-center justify-center p-6 md:p-12">
        <LoginSection onTwoFactorChange={setTwoFactorEmail} />
      </main>
    </div>
  )
}
