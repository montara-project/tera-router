'use client'

import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import React from 'react'

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from '@/components/ui/sidebar'
import { getSidebarMenu, SIDEBAR_GROUPS } from '@/data/sidebar-menu'
import { useBranding } from '@/hooks/use-branding'
import { queries } from '@/lib/api/queries'

import GatewayStatus from './gateway-status'
import NavMain from './nav-main'
import NavSecondary from './nav-secondary'

/** "0.2.6" and "v0.2.6" both render as "v0.2.6"; non-semver builds ("dev") as-is. */
function displayVersion(version: string) {
  return /^\d/.test(version) ? `v${version}` : version
}

export default function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const branding = useBranding()
  const menu = getSidebarMenu()
  const { data: status, isError } = useQuery(queries.system.status())
  const running = !isError && status?.status === 'running'

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className="h-14 flex-row items-center border-b border-sidebar-border px-4 py-0 group-data-[collapsible=icon]:px-[13px]">
        <Link to="/" className="flex min-w-0 flex-1 items-center gap-2.5 rounded-sm">
          <span className="flex size-[22px] shrink-0 items-center justify-center rounded-[5.5px] bg-neutral-100 p-[3px]">
            <img src={branding.logo} alt="" width={16} height={16} />
          </span>
          <span className="truncate text-sm font-semibold tracking-[-0.01em] group-data-[collapsible=icon]:hidden">
            {branding.name}
          </span>
          {status?.version && (
            <span className="text-muted-foreground ml-auto font-mono text-[11px] group-data-[collapsible=icon]:hidden">
              {displayVersion(status.version)}
            </span>
          )}
        </Link>
      </SidebarHeader>
      <SidebarContent className="gap-4 px-2.5 pt-2 pb-4 group-data-[collapsible=icon]:px-2">
        {SIDEBAR_GROUPS.map((group) => (
          <NavMain
            key={group.key}
            title={'hideLabel' in group ? undefined : group.title}
            items={menu.navMenu[group.key]}
            live={running}
          />
        ))}
        {menu.navSetting.length > 0 && <NavMain title="Settings" items={menu.navSetting} />}
        <NavSecondary items={menu.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter className="px-2.5 pt-0 pb-2.5 group-data-[collapsible=icon]:hidden">
        <GatewayStatus />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
