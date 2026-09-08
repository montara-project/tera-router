import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/(protected)/(safety)/provider-health/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/(protected)/(safety)/provider-health/"!</div>
}
