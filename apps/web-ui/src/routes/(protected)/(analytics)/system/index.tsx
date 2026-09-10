import { createFileRoute } from '@tanstack/react-router'

import SectionCard from '@/components/block/common/section-card'

export const Route = createFileRoute('/(protected)/(analytics)/system/')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <SectionCard title="System">
      <div>Hello "/(protected)/(analytics)/system/"!</div>
    </SectionCard>
  )
}
