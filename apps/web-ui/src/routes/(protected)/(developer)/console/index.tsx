import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/(protected)/(developer)/console/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/(protected)/(developer)/console/"!</div>
}
