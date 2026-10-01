import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'

import SectionCard from '@/components/block/common/section-card'
import PricingOverridesCard from '@/components/block/traffic/pricing/pricing-overrides-card'
import { queries } from '@/lib/api/queries'

export const Route = createFileRoute('/(protected)/(traffic)/pricing/')({
  component: PricingRoute,
})

function PricingRoute() {
  const providersQuery = useQuery(queries.providers.list())
  const overview = providersQuery.data?.data
  const providers = [...(overview?.connected ?? []), ...(overview?.available ?? [])]

  return (
    <SectionCard
      title="Model Pricing"
      description="Per-model token rates the gateway charges with. Overrides beat the built-in catalog; a provider-wide override prices every model without a specific row."
    >
      <div className="space-y-4">
        <PricingOverridesCard providers={providers} providersLoading={providersQuery.isLoading} />

        <div className="rounded-xl border border-border bg-background p-4 text-xs text-muted-foreground">
          <p className="font-semibold text-foreground">Resolution order</p>
          <p className="mt-1">
            Per-model override → provider-wide override → built-in static catalog → zero (free). A 0
            / 0 override marks a model &ldquo;free&rdquo; on purpose, and edits apply on the next
            request — no restart.
          </p>
        </div>
      </div>
    </SectionCard>
  )
}
