import { IconKey, IconPlug } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'

import PageHeader from '@/components/block/common/page-header'
import ApiReferenceCard from '@/components/block/traffic/endpoints/api-reference-card'
import ConnectSection from '@/components/block/traffic/endpoints/connect-section'
import QuickStartCard from '@/components/block/traffic/endpoints/quick-start-card'
import TunnelSection from '@/components/block/traffic/endpoints/tunnel-section'
import { Button } from '@/components/ui/button'
import { env } from '@/config/env'
import { queries } from '@/lib/api/queries'

export const Route = createFileRoute('/(protected)/(traffic)/endpoints/')({
  component: RouteComponent,
})

function RouteComponent() {
  const { data: catalog, isError } = useQuery(queries.endpoints.catalog())
  const baseUrl = catalog?.base_url ?? String(env.API_URL)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={IconPlug}
        title="Endpoints"
        description="One base URL and API key for every provider."
        actions={
          <Button asChild variant="outline">
            <Link to="/keys">
              <IconKey className="size-4" />
              <span>Manage keys</span>
            </Link>
          </Button>
        }
      />
      <ConnectSection baseUrl={baseUrl} />
      <QuickStartCard baseUrl={baseUrl} />
      {catalog ? (
        <ApiReferenceCard baseUrl={baseUrl} groups={catalog.groups} />
      ) : isError ? (
        <p className="text-sm text-destructive">Unable to load the API reference.</p>
      ) : null}
      <TunnelSection />
    </div>
  )
}
