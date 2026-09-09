import { createFileRoute } from '@tanstack/react-router'

import LoginSection from '@/components/block/auth/login-section'

export const Route = createFileRoute('/(auth)/(login)/')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background p-6 md:p-10">
      <div className="w-full max-w-sm">
        <LoginSection />
      </div>
    </div>
  )
}
