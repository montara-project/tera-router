import { createRootRoute, createRoute, createRouter, Link, Outlet } from '@tanstack/react-router'

import { Button } from '@/components/ui/button'

const rootRoute = createRootRoute({
  component: () => (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <nav className="flex gap-4 border-b pb-4">
        <Link to="/" className="font-semibold text-primary hover:underline">
          Home
        </Link>
        <Link to="/about" className="font-semibold text-primary hover:underline">
          About
        </Link>
      </nav>
      <main className="pt-6">
        <Outlet />
      </main>
    </div>
  ),
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: () => (
    <section className="space-y-3">
      <h1 className="text-2xl font-bold tracking-tight">Tera Router</h1>
      <p className="text-muted-foreground">Monorepo web UI powered by Vite + TanStack Router.</p>
      <Button onClick={() => alert('shadcn/ui works')}>shadcn Button</Button>
    </section>
  ),
})

const aboutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/about',
  component: () => (
    <section className="space-y-3">
      <h1 className="text-2xl font-bold tracking-tight">About</h1>
      <p className="text-muted-foreground">
        Demo about page for TanStack Router code-based routing.
      </p>
      <Button variant="outline">Outline</Button>
    </section>
  ),
})

const routeTree = rootRoute.addChildren([indexRoute, aboutRoute])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
