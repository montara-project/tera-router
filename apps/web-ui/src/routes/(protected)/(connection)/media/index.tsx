import { createFileRoute } from '@tanstack/react-router'

import SectionCard from '@/components/block/common/section-card'

export const Route = createFileRoute('/(protected)/(connection)/media/')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <SectionCard title="Media">
      <div>Hello "/(protected)/(connection)/media/"!</div>
    </SectionCard>
  )
}
