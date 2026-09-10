import { createFileRoute, Outlet } from '@tanstack/react-router'

import SidebarLayout from '@/components/layout/sidebar/layout'

export const Route = createFileRoute('/(protected)')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <SidebarLayout>
      <Outlet />
    </SidebarLayout>
  )
}
