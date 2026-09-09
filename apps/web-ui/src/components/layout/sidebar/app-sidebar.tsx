'use client'

import { Link } from '@tanstack/react-router'
import React from 'react'

import type { AuthSession } from '@/types/auth'

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
  auth?: AuthSession
}

export default function AppSidebar({ auth, ...props }: AppSidebarProps) {
  const menu = getSidebarMenu()

  const user = auth
    ? {
        name: auth.user.fullname,
        email: auth.user.email,
        avatar: '',
      }
    : { ...menu.user }

  return (
    <Sidebar collapsible="icon" variant="floating" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link to="/">
                <div className="text-sidebar-primary-foreground bg-white p-1 flex aspect-square size-8 items-center justify-center rounded-lg">
                  <img
                    src="https://ik.imagekit.io/4atsn1s5g4/assets/tera.png"
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
        <NavMain title="Settings" items={menu.navSetting} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
