import { createFileRoute } from '@tanstack/react-router'

import SectionCard from '@/components/block/common/section-card'

export const Route = createFileRoute('/(protected)/(analytics)/usage/')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <SectionCard title="Usage">
      <div>Hello "/(protected)/(analytics)/usages/"!</div>
    </SectionCard>
  )
}
