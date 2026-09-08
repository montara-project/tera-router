import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/(protected)/(developer)/cli-tools/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/(protected)/(developer)/cli-tools/"!</div>
}
