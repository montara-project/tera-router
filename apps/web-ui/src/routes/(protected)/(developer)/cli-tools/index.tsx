import { createFileRoute } from '@tanstack/react-router'

import SectionCard from '@/components/block/common/section-card'

export const Route = createFileRoute('/(protected)/(developer)/cli-tools/')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <SectionCard title="CLI Tools">
      <div>Hello "/(protected)/(developer)/cli-tools/"!</div>
    </SectionCard>
  )
}
