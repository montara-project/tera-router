import { createFileRoute } from '@tanstack/react-router'

import SectionCard from '@/components/block/common/section-card'
import ConnectSection from '@/components/block/traffic/endpoints/connect-section'
import HowToUseCard from '@/components/block/traffic/endpoints/how-to-use-card'
import TunnelSection from '@/components/block/traffic/endpoints/tunnel-section'

export const Route = createFileRoute('/(protected)/(traffic)/endpoints/')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <SectionCard
      title="Endpoints"
      description="Connect an application with one base URL and an API key."
    >
      <div className="space-y-4">
        <ConnectSection />
        <TunnelSection />
        <HowToUseCard />
      </div>
    </SectionCard>
  )
}
