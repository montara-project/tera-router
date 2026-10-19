import type { QueryClient } from '@tanstack/react-query'

import { IconArrowLeft, IconError404 } from '@tabler/icons-react'
import { TanStackDevtools } from '@tanstack/react-devtools'
import { ReactQueryDevtoolsPanel } from '@tanstack/react-query-devtools'
import { createRootRouteWithContext, Link, Outlet } from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'

import EmptyState from '@/components/block/common/empty-state'
import { Button } from '@/components/ui/button'
import { Toaster } from '@/components/ui/sonner'
import DecorationProvider from '@/lib/providers/decoration'

/**
 * Root layout component that serves as the main wrapper for the application.
 *
 * Routing conventions:
 * - Use brackets for route grouping: (group)
 * - Prefix with `-` to ignore: -directory/ or -file.tsx
 * - File-based routing supported: e.g. students.add.tsx creates /students/add
 *
 * @see https://tanstack.com/router/latest/docs/framework/react/routing/routing-concepts
 */
const RootLayout = () => (
  <DecorationProvider>
    {/* outlet = react children */}
    <Outlet />
    <Toaster position="bottom-right" richColors closeButton />

    {/* declare devtools panel */}
    {import.meta.env.DEV && (
      <TanStackDevtools
        config={{
          position: 'bottom-right',
        }}
        plugins={[
          {
            name: 'Tanstack Router',
            render: <TanStackRouterDevtoolsPanel />,
          },
          {
            name: 'Tanstack Query',
            render: <ReactQueryDevtoolsPanel />,
          },
        ]}
      />
    )}
  </DecorationProvider>
)

const NotFound = () => (
  <EmptyState
    className="min-h-svh"
    icon={IconError404}
    title="Page not found"
    description="The page you are looking for does not exist or has been moved."
    action={
      <Button asChild variant="outline">
        <Link to="/">
          <IconArrowLeft />
          Back to home
        </Link>
      </Button>
    }
  />
)

interface RouterContext {
  auth: undefined
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  notFoundComponent: NotFound,
})
