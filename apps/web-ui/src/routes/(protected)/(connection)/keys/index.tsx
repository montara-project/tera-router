import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/(protected)/(connection)/keys/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/(protected)/(connection)/keys/"!</div>
}
