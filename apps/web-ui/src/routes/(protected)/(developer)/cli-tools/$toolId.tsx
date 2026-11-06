import { createFileRoute } from '@tanstack/react-router'

import CliToolDetail from '@/components/block/cli-tools/cli-tool-detail'

export const Route = createFileRoute('/(protected)/(developer)/cli-tools/$toolId')({
  component: RouteComponent,
})

function RouteComponent() {
  const { toolId } = Route.useParams()
  // Keyed so the form starts fresh when moving between tools.
  return <CliToolDetail key={toolId} toolId={toolId} />
}
