import { createFileRoute } from '@tanstack/react-router'

import SectionCard from '@/components/block/common/section-card'

export const Route = createFileRoute('/(protected)/(traffic)/endpoints/')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <SectionCard title="Endpoints">
      <div>Hello "/(protected)/(traffic)/endpoints/"!</div>
    </SectionCard>
  )
}
