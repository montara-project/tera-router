'use client'

import { Link } from '@tanstack/react-router'
import React from 'react'

import type { Models } from '@/lib/api/models'
import type { UserInfo } from '@/types/menu'

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
import { getSidebarMenu } from '@/data/sidebar-menu'

import NavMain from './nav-main'
import NavUser from './nav-user'

type AppSidebarProps = React.ComponentProps<typeof Sidebar> & {
  /** The signed-in user from GET /v1/auth/me; undefined while it loads. */
  user?: Models.User | null
  /** True when the profile request failed and no data is available. */
  userError?: boolean
  /** Refetches the profile request, wired to the error state's retry. */
  onRetryUser?: () => void
}

export default function AppSidebar({ user, userError, onRetryUser, ...props }: AppSidebarProps) {
  const menu = getSidebarMenu()

  const userInfo: UserInfo | undefined = user
    ? {
        name: user.fullname,
        email: user.email,
        avatar: '',
      }
    : undefined

  return (
    <Sidebar collapsible="icon" variant="floating" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link to="/">
                <div className="text-sidebar-primary-foreground bg-neutral-100 p-1 flex aspect-square size-8 items-center justify-center rounded-lg">
                  <img
                    src="/static/images/tera.png"
                    alt="Tera Router"
                    width={32}
                    height={32}
                    className="rounded-md"
                  />
                </div>
                <div className="flex flex-col gap-1 leading-none">
                  <span className="font-medium">Tera Router</span>
                  <span className="">AI Router</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain title="Overview" items={menu.navMenu.overview} />
        <NavMain title="Traffic" items={menu.navMenu.traffic} />
        <NavMain title="Connections" items={menu.navMenu.connections} />
        <NavMain title="Safety" items={menu.navMenu.safety} />
        <NavMain title="Cost & Analytics" items={menu.navMenu.analytics} />
        <NavMain title="Developer" items={menu.navMenu.developer} />
        {menu.navSetting.length > 0 && <NavMain title="Settings" items={menu.navSetting} />}
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={userInfo} userError={userError} onRetryUser={onRetryUser} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
