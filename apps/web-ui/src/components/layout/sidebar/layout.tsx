'use client'

import { useQuery } from '@tanstack/react-query'
import React from 'react'

import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { queries } from '@/lib/api/queries'

import AppSidebar from './app-sidebar'
import CommandSearch from './command-search'
import UserMenu from './user-menu'

interface SidebarLayoutProps {
  children: React.ReactNode
}

export default function SidebarLayout({ children }: SidebarLayoutProps) {
  const { data: meData, isError, refetch } = useQuery(queries.auth.me())

  return (
    <SidebarProvider
      style={
        {
          '--sidebar-width': '15rem',
        } as React.CSSProperties
      }
    >
      <AppSidebar />
      {/* min-w-0: a wide table scrolls inside its own panel instead of widening the page.
          h-svh + overflow-hidden: the top bar spans the full width and only #app-main
          scrolls, so its scrollbar starts below the bar. */}
      <SidebarInset className="h-svh min-w-0 overflow-hidden">
        <header className="z-20 flex h-14 shrink-0 items-center gap-3 border-b border-sidebar-border bg-sidebar px-4 md:px-8">
          {/* Desktop collapses via the rail or ⌘B; the trigger opens the drawer on mobile. */}
          <SidebarTrigger className="-ml-1 md:hidden" />
          <CommandSearch />
          <div className="ml-auto">
            <UserMenu
              user={meData?.data}
              userError={isError && !meData?.data}
              onRetryUser={() => void refetch()}
            />
          </div>
        </header>
        {/* main.tsx: scrollToTopSelectors resets it on navigation; the id attribute
            lets the router restore its position on back/forward. */}
        <div
          id="app-main"
          data-scroll-restoration-id="app-main"
          className="scrollbar-seamless min-h-0 flex-1 overflow-y-auto [scrollbar-gutter:stable]"
        >
          <div className="flex min-h-full flex-col gap-5 p-5 lg:p-6">{children}</div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
