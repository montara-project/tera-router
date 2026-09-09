import { createFileRoute } from '@tanstack/react-router'

import SectionCard from '@/components/block/common/section-card'

export const Route = createFileRoute('/(protected)/(developer)/console/')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <SectionCard title="Console Logs">
      <div>Hello "/(protected)/(developer)/console/"!</div>
    </SectionCard>
  )
}
