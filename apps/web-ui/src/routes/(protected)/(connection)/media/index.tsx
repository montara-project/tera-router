import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/(protected)/(connection)/media/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/(protected)/(connection)/media/"!</div>
}
