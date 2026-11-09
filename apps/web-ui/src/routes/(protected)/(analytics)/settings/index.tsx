import { IconSettings } from '@tabler/icons-react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'

import type { AppSettings } from '@/lib/api/models/settings'

import PageHeader from '@/components/block/common/page-header'
import BrandingTab from '@/components/block/settings/branding-tab'
import ImportExportTab from '@/components/block/settings/import-export-tab'
import IPBlockCard from '@/components/block/settings/ip-block-card'
import NetworkTab from '@/components/block/settings/network-tab'
import PasskeysCard from '@/components/block/settings/passkeys-card'
import RestrictedAccessCard from '@/components/block/settings/restricted-access-card'
import RoutingTab from '@/components/block/settings/routing-tab'
import SecurityTab from '@/components/block/settings/security-tab'
import SessionsCard from '@/components/block/settings/sessions-card'
import SystemTab from '@/components/block/settings/system-tab'
import TokenSavingTab from '@/components/block/settings/token-saving-tab'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toastAxiosError } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'

export const Route = createFileRoute('/(protected)/(analytics)/settings/')({
  component: RouteComponent,
})

const TABS = [
  { value: 'token-saving', label: 'Token saving' },
  { value: 'routing', label: 'Routing' },
  { value: 'network', label: 'Network' },
  { value: 'branding', label: 'Branding' },
  { value: 'security', label: 'Security' },
  { value: 'import-export', label: 'Import & export' },
  { value: 'system', label: 'System' },
]

const TAB_CLASS = 'px-3 text-[13px] data-[state=active]:text-foreground!'

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
      onError: toastAxiosError,
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={IconSettings}
        title="Settings"
        description="Gateway behaviour, branding, backups and updates."
        actions={
          <span className="text-[12.5px] text-muted-foreground">Changes save automatically</span>
        }
      />
      <Tabs defaultValue="token-saving">
        <TabsList variant="line" size="md" className="w-full justify-start gap-1 overflow-x-auto">
          {TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} className={TAB_CLASS}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="token-saving" className="mt-5 max-w-[56rem]">
          <TokenSavingTab settings={settings} onUpdate={handleUpdate} />
        </TabsContent>

        <TabsContent value="routing" className="mt-5 max-w-[56rem]">
          <RoutingTab settings={settings} onUpdate={handleUpdate} />
        </TabsContent>

        <TabsContent value="network" className="mt-5 max-w-[56rem]">
          <NetworkTab settings={settings} onUpdate={handleUpdate} />
        </TabsContent>

        <TabsContent value="branding" className="mt-5 max-w-[56rem]">
          <BrandingTab settings={settings} onUpdate={handleUpdate} />
        </TabsContent>

        <TabsContent value="security" className="mt-5 max-w-[56rem]">
          <div className="flex flex-col gap-4">
            <SecurityTab />
            <PasskeysCard />
            <SessionsCard />
            <RestrictedAccessCard />
            <IPBlockCard />
          </div>
        </TabsContent>

        <TabsContent value="import-export" className="mt-5 max-w-[56rem]">
          <ImportExportTab />
        </TabsContent>

        <TabsContent value="system" className="mt-5 max-w-[56rem]">
          <SystemTab version={health?.version} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
