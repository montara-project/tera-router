import { createFileRoute } from '@tanstack/react-router'

import SectionCard from '@/components/block/common/section-card'

export const Route = createFileRoute('/(protected)/(safety)/provider-health/')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <SectionCard title="Provider Health">
      <div>Hello "/(protected)/(safety)/provider-health/"!</div>
    </SectionCard>
  )
}
