import { createFileRoute } from '@tanstack/react-router'

import SectionCard from '@/components/block/common/section-card'

export const Route = createFileRoute('/(protected)/(analytics)/settings/')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <SectionCard title="Settings">
      <div>Hello "/(protected)/(analytics)/settings/"!</div>
    </SectionCard>
  )
}
