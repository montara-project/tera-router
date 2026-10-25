import { createFileRoute } from '@tanstack/react-router'

import CliToolGuideDetail from '@/components/block/cli-tools/cli-tool-guide'

export const Route = createFileRoute('/(protected)/(developer)/cli-tools/$toolId')({
  component: RouteComponent,
})

function RouteComponent() {
  const { toolId } = Route.useParams()
  return <CliToolGuideDetail toolId={toolId} />
}
