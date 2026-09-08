import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/(protected)/(traffic)/chains/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/(protected)/(traffic)/chains/"!</div>
}
