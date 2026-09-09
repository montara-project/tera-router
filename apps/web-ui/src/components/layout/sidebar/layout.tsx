'use client'

import { Link, useLocation } from '@tanstack/react-router'
import React from 'react'

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Separator } from '@/components/ui/separator'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { capitalizeFirstLetter } from '@/lib/string'

import AppSidebar from './app-sidebar'

interface SidebarLayoutProps {
  children: React.ReactNode
}

export default function SidebarLayout({ children }: SidebarLayoutProps) {
  const pathname = useLocation().pathname

  const renderBreadcrumb = () => {
    const pathSegments = pathname.split('/').filter(Boolean)

    if (pathSegments.length === 0) {
      return null
    }

    if (pathSegments.length === 1) {
      return (
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbPage className="font-medium">
                {capitalizeFirstLetter(pathSegments[0])}
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      )
    }

    return (
      <Breadcrumb>
        <BreadcrumbList>
          {pathSegments.map((segment, index) => {
            const isLast = index === pathSegments.length - 1
            const href = '/' + pathSegments.slice(0, index + 1).join('/')
            const displaySegment = capitalizeFirstLetter(segment)

            const matchUUID = segment.match(
              /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
            )

            const newSegment = matchUUID ? '...' + displaySegment.slice(-8) : displaySegment

            return (
              <React.Fragment key={index}>
                <BreadcrumbItem className="hidden md:block">
                  {isLast ? (
                    <BreadcrumbPage className="font-medium">{newSegment}</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink className="font-medium" href={href} asChild>
                      <Link to={href}>{newSegment}</Link>
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
                {!isLast && <BreadcrumbSeparator className="hidden md:block" />}
              </React.Fragment>
            )
          })}
        </BreadcrumbList>
      </Breadcrumb>
    )
  }

  return (
    <SidebarProvider
      style={
        {
          '--sidebar-width': '19rem',
        } as React.CSSProperties
      }
    >
      <AppSidebar />
      <SidebarInset>
        <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
          <div className="flex items-center justify-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator
              orientation="vertical"
              className="my-auto mr-2 data-[orientation=vertical]:h-4"
            />
            {renderBreadcrumb()}
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}
