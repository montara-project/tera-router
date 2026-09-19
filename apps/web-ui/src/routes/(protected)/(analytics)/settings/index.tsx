import {
  IconBolt,
  IconDatabase,
  IconGauge,
  IconNetwork,
  IconPalette,
  IconRoute,
} from '@tabler/icons-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { toast } from 'sonner'

import type { AppSettings } from '@/lib/api/models/settings'

import SectionCard from '@/components/block/common/section-card'
import TokenSavingTab from '@/components/block/settings/token-saving-tab'
import { Card, CardContent } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SETTINGS_QUERY_KEY, settingsQueries } from '@/lib/api/queries/settings'
import { services } from '@/lib/api/services'

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

function PlaceholderTab({ label, icon: Icon }: { label: string; icon: typeof IconGauge }) {
  return (
    <Card>
      <CardContent className="p-0">
        <Empty className="py-14">
          <EmptyHeader>
            <EmptyMedia variant="icon" className="size-12 rounded-full">
              <Icon />
            </EmptyMedia>
            <EmptyTitle>{label} settings</EmptyTitle>
            <EmptyDescription>
              These settings are not available in this version yet.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </CardContent>
    </Card>
  )
}

function RouteComponent() {
  const queryClient = useQueryClient()

  const { data } = useQuery(settingsQueries.get())
  const settings = data?.data

  if (!settings) {
    return <RouteSkeleton />
  }

  const handleUpdate = (patch: Partial<AppSettings>) => {
    services.settings
      .update(patch)
      .then(() => queryClient.invalidateQueries({ queryKey: [SETTINGS_QUERY_KEY] }))
      .catch(() => toast.error('Failed to update settings'))
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

        {TABS.filter((tab) => tab.value !== 'token-saving').map((tab) => (
          <TabsContent key={tab.value} value={tab.value}>
            <PlaceholderTab icon={tab.icon} label={tab.label} />
          </TabsContent>
        ))}
      </Tabs>
    </SectionCard>
  )
}
