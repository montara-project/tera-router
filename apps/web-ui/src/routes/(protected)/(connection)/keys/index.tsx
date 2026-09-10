import { createFileRoute } from '@tanstack/react-router'

import SectionCard from '@/components/block/common/section-card'

export const Route = createFileRoute('/(protected)/(connection)/keys/')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <SectionCard title="API Keys">
      <div>Hello "/(protected)/(connection)/keys/"!</div>
    </SectionCard>
  )
}
