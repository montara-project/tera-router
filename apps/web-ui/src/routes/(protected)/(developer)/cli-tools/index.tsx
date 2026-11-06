import { createFileRoute } from '@tanstack/react-router'

import CliToolsOverview from '@/components/block/cli-tools/cli-tools-overview'

export const Route = createFileRoute('/(protected)/(developer)/cli-tools/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <CliToolsOverview />
}
