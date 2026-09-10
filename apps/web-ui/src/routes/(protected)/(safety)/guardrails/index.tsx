import { createFileRoute } from '@tanstack/react-router'

import SectionCard from '@/components/block/common/section-card'

export const Route = createFileRoute('/(protected)/(safety)/guardrails/')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <SectionCard title="Guardrails">
      <div>Hello "/(protected)/(safety)/guardrails/"!</div>
    </SectionCard>
  )
}
