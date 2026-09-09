import { createFileRoute } from '@tanstack/react-router'

import SectionCard from '@/components/block/common/section-card'
import SimpleTabs from '@/components/block/common/simple-tabs'

export const Route = createFileRoute('/(protected)/dashboard/')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <SectionCard
      title="Overview"
      description="A concise view of traffic, spend, and routing performance."
      toolbar={<SimpleTabs />}
    >
      <div>Hello "/(protected)/dashboard/"!</div>
    </SectionCard>
  )
}
