import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/(protected)/(analytics)/settings/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/(protected)/(analytics)/settings/"!</div>
}
