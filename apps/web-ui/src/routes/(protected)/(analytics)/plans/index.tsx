import { createFileRoute } from '@tanstack/react-router'

import SectionCard from '@/components/block/common/section-card'

export const Route = createFileRoute('/(protected)/(analytics)/plans/')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <SectionCard title="Plans">
      <div>Hello "/(protected)/(analytics)/plans/"!</div>
    </SectionCard>
  )
}
