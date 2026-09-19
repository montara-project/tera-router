import { IconApps, IconPlugConnected, IconPlus, IconSearch } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import type { Models } from '@/lib/api/models'

import IconBadge from '@/components/block/common/icon-badge'
import SectionCard from '@/components/block/common/section-card'
import CapabilityChips from '@/components/block/providers/capability-chips'
import ProviderGrid from '@/components/block/providers/provider-grid'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardHeading,
  CardTitle,
  CardToolbar,
} from '@/components/ui/card'
import { Input, InputWrapper } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { providerQueries } from '@/lib/api/queries/provider'

export const Route = createFileRoute('/(protected)/(connection)/providers/')({
  component: RouteComponent,
})

function RouteSkeleton() {
  return (
    <div className="bg-sidebar border border-sidebar-accent p-2 rounded-2xl">
      <div className="space-y-4 rounded-lg border border-border bg-background p-4">
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-9 w-2/3 rounded-lg" />
        <Skeleton className="h-64 w-full rounded-lg" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    </div>
  )
}

function ProvidersCard({
  count,
  description,
  icon,
  providers,
  title,
  variant,
}: {
  count: number
  description: string
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
  providers: Models.Provider[]
  title: string
  variant: 'connected' | 'available'
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3.5">
          <IconBadge icon={icon} variant="soft" className="h-10 w-10" iconClassName="h-5 w-5" />
          <CardHeading>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeading>
        </div>
        <CardToolbar>
          <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium tabular-nums">
            {count}
          </span>
        </CardToolbar>
      </CardHeader>
      <CardContent className="p-0">
        <ProviderGrid providers={providers} variant={variant} />
      </CardContent>
    </Card>
  )
}

function RouteComponent() {
  const [search, setSearch] = useState('')
  const [capability, setCapability] = useState('all')

  const { data } = useQuery(providerQueries.list())
  const overview = data?.data

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    const matches = (provider: Models.Provider) =>
      (capability === 'all' ||
        provider.capabilities.includes(capability as Models.ProviderCapability)) &&
      (!query || `${provider.name} ${provider.slug}`.toLowerCase().includes(query))

    return {
      connected: (overview?.connected ?? []).filter(matches),
      available: (overview?.available ?? []).filter(matches),
    }
  }, [overview, search, capability])

  if (!overview) {
    return <RouteSkeleton />
  }

  const handleNewProvider = () => {
    toast.info('Custom provider connection is not wired to the backend yet')
  }

  return (
    <SectionCard
      title="Providers"
      description="Connect and manage AI providers to power your routing."
      toolbar={
        <Button
          className="bg-amber-600 text-white hover:bg-amber-500 dark:bg-amber-800 dark:text-amber-200 dark:hover:bg-amber-700"
          onClick={handleNewProvider}
        >
          <IconPlus />
          <span>New custom provider</span>
        </Button>
      }
    >
      <div className="space-y-4">
        <InputWrapper variant="lg" className="rounded-lg">
          <IconSearch />
          <Input
            aria-label="Search providers"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search providers..."
            value={search}
          />
        </InputWrapper>

        <CapabilityChips value={capability} onChange={setCapability} />

        <ProvidersCard
          count={filtered.connected.length}
          description="These providers have accounts and are ready to use."
          icon={IconPlugConnected}
          providers={filtered.connected}
          title="Connected providers"
          variant="connected"
        />

        <ProvidersCard
          count={filtered.available.length}
          description="Add new providers to expand your routing options."
          icon={IconApps}
          providers={filtered.available}
          title="Available providers"
          variant="available"
        />
      </div>
    </SectionCard>
  )
}
