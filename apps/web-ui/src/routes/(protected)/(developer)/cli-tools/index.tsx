import { createFileRoute } from '@tanstack/react-router'

import CliToolsGrid from '@/components/block/cli-tools/cli-tools-grid'
import SectionCard from '@/components/block/common/section-card'

export const Route = createFileRoute('/(protected)/(developer)/cli-tools/')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <SectionCard
      title="CLI Tools"
      description="One-click configuration for coding tools, wired to this KeiRouter instance."
    >
      <CliToolsGrid />
    </SectionCard>
  )
}
