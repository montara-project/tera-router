import { IconCheck } from '@tabler/icons-react'

export type Role = 'admin'

export type NavSubItem = {
  title: string
  url: string
  icon?: typeof IconCheck
}

export type NavMainItem = {
  title: string
  url: string
  icon: typeof IconCheck
  isActive?: boolean
  /** Shows a green dot while the gateway is running (e.g. the live console). */
  live?: boolean
  /** Extra paths that also mark this item active (e.g. /budgets under Plans & budgets). */
  activeOn?: string[]
  /** Left out of the sidebar but still listed in ⌘K search. */
  hidden?: boolean
  items: NavSubItem[]
}

export type ProjectItem = {
  name: string
  url: string
  icon: typeof IconCheck
}

export type UserInfo = {
  name: string
  email: string
  avatar: string
}

export type SidebarMenuData = {
  user: UserInfo
  navMenu: {
    overview: NavMainItem[]
    routing: NavMainItem[]
    providers: NavMainItem[]
    access: NavMainItem[]
    workspace: NavMainItem[]
  }
  navSetting: NavMainItem[]
  navSecondary: NavSecondaryItem[]
}

/** External link pinned to the bottom of the sidebar (docs, repo, feedback). */
export type NavSecondaryItem = {
  title: string
  url: string
  icon: typeof IconCheck
}
