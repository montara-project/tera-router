'use client'

import { IconChevronRight } from '@tabler/icons-react'
import { Link, useLocation } from '@tanstack/react-router'

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from '@/components/ui/sidebar'
import { type NavMainItem } from '@/types/menu'

type NavMainProps = {
  title: string
  items: NavMainItem[]
}

/**
 * sidebar-08 layout: the parent row is always a link, and items with
 * children get a separate chevron action that toggles the sub-menu.
 */
export default function NavMain({ title, items }: NavMainProps) {
  const pathname = useLocation().pathname

  return (
    <SidebarGroup>
      <SidebarGroupLabel className="text-muted-foreground text-xs">{title}</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => {
          const childActive = item.items.some((sub) => pathname.includes(sub.url))

          return (
            <Collapsible key={item.title} asChild defaultOpen={item.isActive || childActive}>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  tooltip={item.title}
                  isActive={pathname.includes(item.url) || childActive}
                >
                  <Link to={item.url}>
                    {item.icon && <item.icon />}
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
                {item.items.length > 0 && (
                  <>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuAction className="data-[state=open]:rotate-90">
                        <IconChevronRight />
                        <span className="sr-only">Toggle {item.title}</span>
                      </SidebarMenuAction>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {item.items.map((subItem) => (
                          <SidebarMenuSubItem key={subItem.title}>
                            <SidebarMenuSubButton asChild isActive={pathname.includes(subItem.url)}>
                              <Link to={subItem.url}>
                                {subItem.icon && <subItem.icon />}
                                <span>{subItem.title}</span>
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </>
                )}
              </SidebarMenuItem>
            </Collapsible>
          )
        })}
      </SidebarMenu>
    </SidebarGroup>
  )
}
