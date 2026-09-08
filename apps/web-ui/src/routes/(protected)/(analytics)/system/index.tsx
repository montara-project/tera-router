import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/(protected)/(analytics)/system/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/(protected)/(analytics)/system/"!</div>
}
