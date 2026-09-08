import type { QueryClient } from '@tanstack/react-query'

import { TanStackDevtools } from '@tanstack/react-devtools'
import { ReactQueryDevtoolsPanel } from '@tanstack/react-query-devtools'
import { createRootRouteWithContext, Outlet } from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'

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

interface RouterContext {
  auth: undefined
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  notFoundComponent: () => <div>Not Found</div>,
})
