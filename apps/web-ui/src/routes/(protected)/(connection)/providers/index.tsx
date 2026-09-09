import { createFileRoute } from '@tanstack/react-router'

import SectionCard from '@/components/block/common/section-card'

export const Route = createFileRoute('/(protected)/(connection)/providers/')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <SectionCard title="Providers">
      <div>Hello "/(protected)/(connection)/providers/"!</div>
    </SectionCard>
  )
}
