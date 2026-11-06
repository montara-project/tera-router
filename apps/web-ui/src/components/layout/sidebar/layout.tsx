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
      {/* min-w-0: a wide table scrolls inside its own panel instead of widening the page. */}
      <SidebarInset className="min-w-0">
        <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-b border-sidebar-border bg-sidebar px-4 md:px-8">
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
        <div className="flex flex-1 flex-col gap-5 p-5 lg:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}
