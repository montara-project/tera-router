'use client'

import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import React from 'react'

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
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
  const { data: status } = useQuery(queries.system.status())

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className="h-12 justify-center border-b border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Link to="/">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-neutral-100 p-0.5">
                  <img src={branding.logo} alt="" width={20} height={20} className="rounded-sm" />
                </span>
                <span className="truncate text-sm font-semibold">{branding.name}</span>
                {status?.version && (
                  <span className="text-muted-foreground ml-auto font-mono text-[11px]">
                    {displayVersion(status.version)}
                  </span>
                )}
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent className="gap-0 py-1">
        {SIDEBAR_GROUPS.map(({ key, title }) => (
          <NavMain key={key} title={title} items={menu.navMenu[key]} />
        ))}
        {menu.navSetting.length > 0 && <NavMain title="Settings" items={menu.navSetting} />}
        <NavSecondary items={menu.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <GatewayStatus />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
