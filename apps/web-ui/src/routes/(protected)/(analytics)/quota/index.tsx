import { createFileRoute } from '@tanstack/react-router'

import SectionCard from '@/components/block/common/section-card'

export const Route = createFileRoute('/(protected)/(analytics)/quota/')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <SectionCard title="Quota Tracker">
      <div>Hello "/(protected)/(analytics)/quota/"!</div>
    </SectionCard>
  )
}
