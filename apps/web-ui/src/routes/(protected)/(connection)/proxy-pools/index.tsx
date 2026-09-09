import { createFileRoute } from '@tanstack/react-router'

import SectionCard from '@/components/block/common/section-card'

export const Route = createFileRoute('/(protected)/(connection)/proxy-pools/')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <SectionCard title="Proxy Pools">
      <div>Hello "/(protected)/(connection)/proxy-pools/"!</div>
    </SectionCard>
  )
}
