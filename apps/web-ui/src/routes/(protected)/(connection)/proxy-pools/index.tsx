import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/(protected)/(connection)/proxy-pools/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/(protected)/(connection)/proxy-pools/"!</div>
}
