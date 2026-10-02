import {
  IconBolt,
  IconDatabase,
  IconGauge,
  IconNetwork,
  IconPalette,
  IconRoute,
} from '@tabler/icons-react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { toast } from 'sonner'

import type { AppSettings } from '@/lib/api/models/settings'

import SectionCard from '@/components/block/common/section-card'
import BrandingTab from '@/components/block/settings/branding-tab'
import ImportExportTab from '@/components/block/settings/import-export-tab'
import NetworkTab from '@/components/block/settings/network-tab'
import RoutingTab from '@/components/block/settings/routing-tab'
import SystemTab from '@/components/block/settings/system-tab'
import TokenSavingTab from '@/components/block/settings/token-saving-tab'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { queries } from '@/lib/api/queries'

export const Route = createFileRoute('/(protected)/(analytics)/settings/')({
  component: RouteComponent,
})

const TABS = [
  { value: 'token-saving', label: 'Token Saving', icon: IconBolt },
  { value: 'routing', label: 'Routing', icon: IconRoute },
  { value: 'network', label: 'Network', icon: IconNetwork },
  { value: 'branding', label: 'Branding', icon: IconPalette },
  { value: 'import-export', label: 'Import / Export', icon: IconDatabase },
  { value: 'system', label: 'System', icon: IconGauge },
]

const ACTIVE_TAB_CLASS =
  'data-[state=active]:border-emerald-500! data-[state=active]:text-emerald-400! data-[state=active]:[&_svg]:text-emerald-400!'

function RouteSkeleton() {
  return (
    <div className="bg-sidebar border border-sidebar-accent p-2 rounded-2xl">
      <div className="space-y-4 rounded-lg border border-border bg-background p-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-56 w-full rounded-lg" />
      </div>
    </div>
  )
}

function RouteComponent() {
  const { data } = useQuery(queries.settings.get())
  const settings = data?.data
  const { data: health } = useQuery(queries.system.health())

  const updateMutation = useMutation(queries.settings.update())

  if (!settings) {
    return <RouteSkeleton />
  }

  const handleUpdate = (patch: Partial<AppSettings>) => {
    updateMutation.mutate(patch, {
      onError: () => toast.error('Failed to update settings'),
    })
  }

  return (
    <SectionCard title="Settings" description="Configure token saving, routing, network, and more.">
      <Tabs defaultValue="token-saving">
        <TabsList variant="line" size="lg" className="w-full justify-start">
          {TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} className={ACTIVE_TAB_CLASS}>
              <tab.icon className="h-4 w-4" />
              <span>{tab.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="token-saving">
          <TokenSavingTab settings={settings} onUpdate={handleUpdate} />
        </TabsContent>

        <TabsContent value="routing">
          <RoutingTab settings={settings} onUpdate={handleUpdate} />
        </TabsContent>

        <TabsContent value="network">
          <NetworkTab settings={settings} onUpdate={handleUpdate} />
        </TabsContent>

        <TabsContent value="branding">
          <BrandingTab settings={settings} onUpdate={handleUpdate} />
        </TabsContent>

        <TabsContent value="import-export">
          <ImportExportTab />
        </TabsContent>

        <TabsContent value="system">
          <SystemTab version={health?.version} />
        </TabsContent>
      </Tabs>
    </SectionCard>
  )
}
