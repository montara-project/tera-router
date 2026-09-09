import { createFileRoute } from '@tanstack/react-router'

import SectionCard from '@/components/block/common/section-card'

export const Route = createFileRoute('/(protected)/(traffic)/skills/')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <SectionCard title="Skills">
      <div>Hello "/(protected)/(traffic)/skills/"!</div>
    </SectionCard>
  )
}
