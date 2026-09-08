import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/(protected)/(analytics)/usages/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/(protected)/(analytics)/usages/"!</div>
}
