import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/(protected)/(analytics)/quota/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/(protected)/(analytics)/quota/"!</div>
}
