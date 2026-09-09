import { createFileRoute } from '@tanstack/react-router'

import SectionCard from '@/components/block/common/section-card'

export const Route = createFileRoute('/(protected)/(traffic)/chains/')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <SectionCard title="Chains">
      <div>Hello "/(protected)/(traffic)/chains/"!</div>
    </SectionCard>
  )
}
