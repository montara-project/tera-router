import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/(protected)/(traffic)/skills/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/(protected)/(traffic)/skills/"!</div>
}
