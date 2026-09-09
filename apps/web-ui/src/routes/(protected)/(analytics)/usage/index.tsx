import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/(protected)/(analytics)/usage/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/(protected)/(analytics)/usages/"!</div>
}
