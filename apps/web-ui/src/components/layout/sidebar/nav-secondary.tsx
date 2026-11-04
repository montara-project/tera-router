import type React from 'react'

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { cn } from '@/lib/utils'
import { type NavSecondaryItem } from '@/types/menu'

type NavSecondaryProps = React.ComponentPropsWithoutRef<typeof SidebarGroup> & {
  items: NavSecondaryItem[]
}

/** Small external links pinned under the main nav (sidebar-08's secondary group). */
export default function NavSecondary({ items, className, ...props }: NavSecondaryProps) {
  return (
    <SidebarGroup className={cn('p-0', className)} {...props}>
      <SidebarGroupContent>
        <SidebarMenu className="gap-px">
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                asChild
                size="sm"
                tooltip={item.title}
                className="text-muted-foreground hover:text-sidebar-foreground gap-2.5 rounded-sm px-2.5"
              >
                <a href={item.url} target="_blank" rel="noreferrer">
                  <item.icon stroke={1.75} />
                  <span>{item.title}</span>
                </a>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
