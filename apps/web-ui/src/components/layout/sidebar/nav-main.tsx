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
  /** Omit to render the group without a heading (the top group). */
  title?: string
  items: NavMainItem[]
  /** Gateway is running; lights the dot on `live` items. */
  live?: boolean
}

/**
 * sidebar-08 layout: the parent row is always a link, and items with
 * children get a separate chevron action that toggles the sub-menu.
 */
export default function NavMain({ title, items, live = false }: NavMainProps) {
  const pathname = useLocation().pathname

  return (
    <SidebarGroup className="p-0">
      {title && (
        <SidebarGroupLabel className="text-muted-foreground h-auto px-2.5 pb-1.5 text-[11.5px] leading-normal">
          {title}
        </SidebarGroupLabel>
      )}
      <SidebarMenu className="gap-px">
        {items
          .filter((item) => !item.hidden)
          .map((item) => {
            const childActive = [
              ...item.items.map((sub) => sub.url),
              ...(item.activeOn ?? []),
            ].some((url) => pathname.includes(url))

            return (
              <Collapsible key={item.title} asChild defaultOpen={item.isActive || childActive}>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    tooltip={item.title}
                    isActive={pathname.includes(item.url) || childActive}
                    className="text-sidebar-foreground/80 hover:text-sidebar-foreground data-active:bg-sidebar-primary/12 data-active:text-sidebar-foreground h-8 gap-2.5 rounded-sm px-2.5 text-[13px] font-medium"
                  >
                    <Link to={item.url}>
                      {item.icon && <item.icon stroke={1.75} />}
                      <span className="flex-1">{item.title}</span>
                      {item.live && live && (
                        <span className="size-1.5 shrink-0 rounded-full bg-emerald-500/75">
                          <span className="sr-only">(live)</span>
                        </span>
                      )}
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
                              <SidebarMenuSubButton
                                asChild
                                isActive={pathname.includes(subItem.url)}
                              >
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
